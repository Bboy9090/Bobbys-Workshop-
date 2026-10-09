use bytes::Bytes;
use futures::stream;
use mtp_rs::mtp::{MtpDevice, NewObjectInfo, ObjectHandle, Storage};
use serde::Serialize;
use std::path::PathBuf;
use tokio::io::AsyncReadExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpStorageSummary {
    pub description: String,
    pub free_space_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpStatus {
    pub connected: bool,
    pub manufacturer: String,
    pub model: String,
    pub serial_number: String,
    pub device_family: String,
    pub storages: Vec<MtpStorageSummary>,
    pub capabilities: Vec<&'static str>,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpRootObject {
    pub handle: String,
    pub filename: String,
    pub is_folder: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpBrowserObject {
    pub filename: String,
    pub path: Vec<String>,
    pub is_folder: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpTransferResult {
    pub operation: &'static str,
    pub filename: String,
    pub bytes: u64,
    pub verified: bool,
    pub destination: String,
    pub evidence_source: &'static str,
}

async fn resolve_folder_path(
    storage: &Storage,
    path: &[String],
) -> Result<Option<ObjectHandle>, String> {
    let mut parent = None;

    for segment in path {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("MTP folder path contains an invalid segment".to_string());
        }

        let objects = storage
            .list_objects(parent)
            .await
            .map_err(|e| format!("MTP listing failed while resolving {segment}: {e}"))?;

        let mut matches = objects
            .into_iter()
            .filter(|object| object.is_folder() && object.filename == *segment);

        let found = matches
            .next()
            .ok_or_else(|| format!("MTP folder path segment was not found: {segment}"))?;

        if matches.next().is_some() {
            return Err(format!(
                "MTP folder path is ambiguous because multiple folders are named {segment}"
            ));
        }

        parent = Some(found.handle);
    }

    Ok(parent)
}

async fn find_object_by_path(
    storage: &Storage,
    path: &[String],
) -> Result<mtp_rs::mtp::ObjectInfo, String> {
    let (filename, parent_path) = path
        .split_last()
        .ok_or_else(|| "MTP object path cannot be empty".to_string())?;

    let parent = resolve_folder_path(storage, parent_path).await?;
    let objects = storage
        .list_objects(parent)
        .await
        .map_err(|e| format!("MTP listing failed while resolving object: {e}"))?;

    let mut matches = objects
        .into_iter()
        .filter(|object| object.filename == *filename);

    let found = matches
        .next()
        .ok_or_else(|| format!("MTP object was not found: {}", path.join("/")))?;

    if matches.next().is_some() {
        return Err(format!(
            "MTP object path is ambiguous because multiple objects share this name: {}",
            path.join("/")
        ));
    }

    Ok(found)
}

fn classify_device_family(manufacturer: &str, model: &str) -> String {
    let haystack = format!("{} {}", manufacturer, model).to_ascii_lowercase();
    if haystack.contains("samsung") {
        "samsung".to_string()
    } else if haystack.contains("google") || haystack.contains("pixel") {
        "google".to_string()
    } else if haystack.contains("motorola") {
        "motorola".to_string()
    } else if haystack.contains("xiaomi") || haystack.contains("redmi") || haystack.contains("poco") {
        "xiaomi".to_string()
    } else if haystack.contains("oneplus") {
        "oneplus".to_string()
    } else {
        "android-or-mtp-device".to_string()
    }
}

#[tauri::command]
pub async fn mtp_status() -> Result<MtpStatus, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let info = device.device_info();
    let manufacturer = info.manufacturer.clone();
    let model = info.model.clone();
    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?
        .into_iter()
        .map(|storage| MtpStorageSummary {
            description: storage.info().description.clone(),
            free_space_bytes: storage.info().free_space,
        })
        .collect();

    Ok(MtpStatus {
        connected: true,
        device_family: classify_device_family(&manufacturer, &model),
        manufacturer,
        model,
        serial_number: info.serial_number.clone(),
        storages,
        capabilities: vec![
            "device-info",
            "storage-info",
            "list",
            "download",
            "upload",
            "delete",
            "move",
            "copy",
            "rename",
            "create-folder",
        ],
        evidence_source: "mtp:GetDeviceInfo+GetStorageInfo",
    })
}

#[tauri::command]
pub async fn mtp_list_root(storage_index: usize) -> Result<Vec<MtpRootObject>, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;

    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let objects = storage
        .list_objects(None)
        .await
        .map_err(|e| format!("MTP root listing failed: {e}"))?;

    Ok(objects
        .into_iter()
        .map(|object| {
            let is_folder = object.is_folder();
            MtpRootObject {
                handle: format!("{:?}", object.handle),
                filename: object.filename,
                is_folder,
            }
        })
        .collect())
}


#[tauri::command]
pub async fn mtp_download_file(
    storage_index: usize,
    handle: String,
    destination_path: String,
) -> Result<MtpTransferResult, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;
    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let objects = storage
        .list_objects(None)
        .await
        .map_err(|e| format!("MTP listing failed before download: {e}"))?;
    let object = objects
        .into_iter()
        .find(|object| format!("{:?}", object.handle) == handle)
        .ok_or_else(|| format!("MTP object handle {handle} was not found in the selected storage root"))?;

    if object.is_folder() {
        return Err("Folder download is not exposed by this command; choose a file.".to_string());
    }

    let destination = PathBuf::from(&destination_path);
    if let Some(parent) = destination.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create destination directory: {e}"))?;
    }

    let mut output = tokio::fs::File::create(&destination)
        .await
        .map_err(|e| format!("Failed to create download destination: {e}"))?;

    let mut download = storage
        .download_windowed_default(object.handle)
        .await
        .map_err(|e| format!("MTP download initialization failed: {e}"))?;

    let expected = download.size();
    let mut written = 0_u64;

    while let Some(window) = download.next_window().await {
        let bytes = window.map_err(|e| format!("MTP download failed: {e}"))?;
        tokio::io::AsyncWriteExt::write_all(&mut output, &bytes)
            .await
            .map_err(|e| format!("Failed writing downloaded bytes: {e}"))?;
        written += bytes.len() as u64;
    }

    tokio::io::AsyncWriteExt::flush(&mut output)
        .await
        .map_err(|e| format!("Failed to flush downloaded file: {e}"))?;
    drop(output);

    let on_disk = tokio::fs::metadata(&destination)
        .await
        .map_err(|e| format!("Failed to verify downloaded file: {e}"))?
        .len();

    if written != on_disk || (expected > 0 && on_disk != expected) {
        let _ = tokio::fs::remove_file(&destination).await;
        return Err(format!(
            "Download verification failed: stream wrote {written} bytes, file contains {on_disk}, expected {expected}"
        ));
    }

    Ok(MtpTransferResult {
        operation: "download",
        filename: object.filename,
        bytes: on_disk,
        verified: true,
        destination: destination.to_string_lossy().to_string(),
        evidence_source: "mtp:windowed-download+local-size-verification",
    })
}

#[tauri::command]
pub async fn mtp_upload_file(
    storage_index: usize,
    parent_handle: Option<String>,
    source_path: String,
) -> Result<MtpTransferResult, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;
    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let source = PathBuf::from(&source_path);
    let metadata = tokio::fs::metadata(&source)
        .await
        .map_err(|e| format!("Source file is not readable: {e}"))?;
    if !metadata.is_file() {
        return Err("MTP upload source must be a regular file".to_string());
    }

    let filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Source filename is not valid UTF-8".to_string())?
        .to_string();

    let parent = match parent_handle {
        None => None,
        Some(ref requested) => {
            let objects = storage
                .list_objects(None)
                .await
                .map_err(|e| format!("MTP listing failed before upload: {e}"))?;
            let parent_object = objects
                .into_iter()
                .find(|object| format!("{:?}", object.handle) == *requested)
                .ok_or_else(|| format!("Destination folder handle {requested} was not found"))?;
            if !parent_object.is_folder() {
                return Err("MTP upload destination must be a folder".to_string());
            }
            Some(parent_object.handle)
        }
    };

    let file = tokio::fs::File::open(&source)
        .await
        .map_err(|e| format!("Failed to open upload source: {e}"))?;

    let data_stream = stream::unfold(file, |mut file| async move {
        let mut buffer = vec![0_u8; 1024 * 1024];
        match file.read(&mut buffer).await {
            Ok(0) => None,
            Ok(read) => {
                buffer.truncate(read);
                Some((Ok::<Bytes, std::io::Error>(Bytes::from(buffer)), file))
            }
            Err(error) => Some((Err(error), file)),
        }
    });

    let info = NewObjectInfo::file(&filename, metadata.len());
    let upload = storage.upload(parent, info, Box::pin(data_stream)).await;

    let uploaded_handle = match upload {
        Ok(handle) => handle,
        Err(error) => {
            let partial = error.partial;
            let message = error.to_string();
            if let Some(partial_handle) = partial {
                let cleanup = storage.delete(partial_handle).await;
                return match cleanup {
                    Ok(_) => Err(format!("MTP upload failed and partial object was removed: {message}")),
                    Err(cleanup_error) => Err(format!(
                        "MTP upload failed and partial cleanup also failed: {message}; cleanup: {cleanup_error}"
                    )),
                };
            }
            return Err(format!("MTP upload failed: {message}"));
        }
    };

    let objects = storage
        .list_objects(parent)
        .await
        .map_err(|e| format!("Upload completed but verification listing failed: {e}"))?;
    let verified = objects
        .iter()
        .any(|object| object.handle == uploaded_handle && object.filename == filename);

    if !verified {
        return Err("MTP upload returned success but post-upload verification could not find the object".to_string());
    }

    Ok(MtpTransferResult {
        operation: "upload",
        filename,
        bytes: metadata.len(),
        verified: true,
        destination: format!("mtp:{storage_index}:{:?}", uploaded_handle),
        evidence_source: "mtp:SendObjectInfo+SendObject+post-list-verification",
    })
}


#[tauri::command]
pub async fn mtp_list_directory(
    storage_index: usize,
    path: Vec<String>,
) -> Result<Vec<MtpBrowserObject>, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;
    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let parent = resolve_folder_path(storage, &path).await?;
    let objects = storage
        .list_objects(parent)
        .await
        .map_err(|e| format!("MTP directory listing failed: {e}"))?;

    Ok(objects
        .into_iter()
        .map(|object| {
            let is_folder = object.is_folder();
            let size_bytes = object.size;
            let filename = object.filename;
            let mut object_path = path.clone();
            object_path.push(filename.clone());
            MtpBrowserObject {
                filename,
                path: object_path,
                is_folder,
                size_bytes,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn mtp_download_path(
    storage_index: usize,
    object_path: Vec<String>,
    destination_path: String,
) -> Result<MtpTransferResult, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;
    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let object = find_object_by_path(storage, &object_path).await?;
    if object.is_folder() {
        return Err("Folder download is not exposed by this command; choose a file.".to_string());
    }

    let destination = PathBuf::from(&destination_path);
    if let Some(parent) = destination.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create destination directory: {e}"))?;
    }

    let mut output = tokio::fs::File::create(&destination)
        .await
        .map_err(|e| format!("Failed to create download destination: {e}"))?;

    let mut download = storage
        .download_windowed_default(object.handle)
        .await
        .map_err(|e| format!("MTP download initialization failed: {e}"))?;

    let expected = download.size();
    let mut written = 0_u64;

    while let Some(window) = download.next_window().await {
        let bytes = window.map_err(|e| format!("MTP download failed: {e}"))?;
        tokio::io::AsyncWriteExt::write_all(&mut output, &bytes)
            .await
            .map_err(|e| format!("Failed writing downloaded bytes: {e}"))?;
        written += bytes.len() as u64;
    }

    tokio::io::AsyncWriteExt::flush(&mut output)
        .await
        .map_err(|e| format!("Failed to flush downloaded file: {e}"))?;
    drop(output);

    let on_disk = tokio::fs::metadata(&destination)
        .await
        .map_err(|e| format!("Failed to verify downloaded file: {e}"))?
        .len();

    if written != on_disk || (expected > 0 && on_disk != expected) {
        let _ = tokio::fs::remove_file(&destination).await;
        return Err(format!(
            "Download verification failed: stream wrote {written} bytes, file contains {on_disk}, expected {expected}"
        ));
    }

    Ok(MtpTransferResult {
        operation: "download",
        filename: object.filename,
        bytes: on_disk,
        verified: true,
        destination: destination.to_string_lossy().to_string(),
        evidence_source: "mtp:path-resolve+windowed-download+local-size-verification",
    })
}

#[tauri::command]
pub async fn mtp_upload_path(
    storage_index: usize,
    folder_path: Vec<String>,
    source_path: String,
) -> Result<MtpTransferResult, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let storages = device
        .storages()
        .await
        .map_err(|e| format!("MTP storage discovery failed: {e}"))?;
    let storage = storages
        .get(storage_index)
        .ok_or_else(|| format!("MTP storage index {storage_index} does not exist"))?;

    let parent = resolve_folder_path(storage, &folder_path).await?;

    let source = PathBuf::from(&source_path);
    let metadata = tokio::fs::metadata(&source)
        .await
        .map_err(|e| format!("Source file is not readable: {e}"))?;
    if !metadata.is_file() {
        return Err("MTP upload source must be a regular file".to_string());
    }

    let filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Source filename is not valid UTF-8".to_string())?
        .to_string();

    let file = tokio::fs::File::open(&source)
        .await
        .map_err(|e| format!("Failed to open upload source: {e}"))?;

    let data_stream = stream::unfold(file, |mut file| async move {
        let mut buffer = vec![0_u8; 1024 * 1024];
        match file.read(&mut buffer).await {
            Ok(0) => None,
            Ok(read) => {
                buffer.truncate(read);
                Some((Ok::<Bytes, std::io::Error>(Bytes::from(buffer)), file))
            }
            Err(error) => Some((Err(error), file)),
        }
    });

    let info = NewObjectInfo::file(&filename, metadata.len());
    let upload = storage.upload(parent, info, Box::pin(data_stream)).await;

    let uploaded_handle = match upload {
        Ok(handle) => handle,
        Err(error) => {
            let partial = error.partial;
            let message = error.to_string();
            if let Some(partial_handle) = partial {
                let cleanup = storage.delete(partial_handle).await;
                return match cleanup {
                    Ok(_) => Err(format!("MTP upload failed and partial object was removed: {message}")),
                    Err(cleanup_error) => Err(format!(
                        "MTP upload failed and partial cleanup also failed: {message}; cleanup: {cleanup_error}"
                    )),
                };
            }
            return Err(format!("MTP upload failed: {message}"));
        }
    };

    let objects = storage
        .list_objects(parent)
        .await
        .map_err(|e| format!("Upload completed but verification listing failed: {e}"))?;
    let verified = objects
        .iter()
        .any(|object| object.handle == uploaded_handle && object.filename == filename);

    if !verified {
        return Err("MTP upload returned success but post-upload verification could not find the object".to_string());
    }

    let mut destination_path = folder_path;
    destination_path.push(filename.clone());

    Ok(MtpTransferResult {
        operation: "upload",
        filename,
        bytes: metadata.len(),
        verified: true,
        destination: format!("mtp:/{}", destination_path.join("/")),
        evidence_source: "mtp:path-resolve+SendObjectInfo+SendObject+post-list-verification",
    })
}
