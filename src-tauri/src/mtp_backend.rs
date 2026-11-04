use bytes::Bytes;
use futures::stream;
use mtp_rs::mtp::{MtpDevice, NewObjectInfo, ObjectHandle, Storage};
use serde::Serialize;
use std::path::PathBuf;
use tokio::io::AsyncReadExt;

#[derive(Clone, Debug)]
struct UsbMtpTarget {
    vendor_id: u16,
    product_id: u16,
    location_id: u64,
    serial: Option<String>,
}

impl UsbMtpTarget {
    fn token(&self) -> String {
        use sha2::{Digest, Sha256};
        // Keep location IDs out of JavaScript numbers; bind every USB identity field.
        let identity = serde_json::to_vec(&(
            self.vendor_id, self.product_id, self.location_id, &self.serial,
        )).expect("USB identity tuple is serializable");
        format!("{:x}", Sha256::digest(identity))
    }
}

fn usb_mtp_targets() -> Result<Vec<UsbMtpTarget>, String> {
    // WPD includes fixed host disks. Discover USB MTP interfaces first and
    // never let the backend select an unrelated first WPD device.
    MtpDevice::list_devices()
        .map(|devices| devices.into_iter().map(|device| UsbMtpTarget {
            vendor_id: device.vendor_id,
            product_id: device.product_id,
            location_id: device.location_id,
            serial: device.serial_number,
        }).collect())
        .map_err(|error| format!("USB MTP discovery unavailable: {error}"))
}

fn select_usb_mtp_target<'a>(
    targets: &'a [UsbMtpTarget],
    expected: Option<&str>,
) -> Result<&'a UsbMtpTarget, String> {
    if targets.len() != 1 {
        return Err(if targets.is_empty() {
            "No USB-backed MTP target detected; host WPD storage is not a phone".to_string()
        } else {
            "Multiple USB MTP targets detected; keep one connected before using this file session".to_string()
        });
    }
    let target = &targets[0];
    if target.serial.as_deref().is_none_or(|serial| serial.trim().is_empty()) {
        return Err("USB MTP identity has no stable serial; file actions remain unverified".to_string());
    }
    if let Some(expected) = expected {
        if expected.len() != 64
            || !expected.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || expected != target.token()
        {
            return Err("MTP target changed or disconnected; rescan before using file actions".to_string());
        }
    }
    Ok(target)
}

async fn open_usb_mtp_target(expected: Option<&str>) -> Result<(MtpDevice, String), String> {
    let targets = usb_mtp_targets()?;
    let target = select_usb_mtp_target(&targets, expected)?.clone();
    let token = target.token();
    let device = MtpDevice::open_by_location(target.location_id).await
        .map_err(|error| format!("USB-bound MTP session failed: {error}"))?;
    // Recheck after the asynchronous WPD/USB open, before storage operations.
    select_usb_mtp_target(&usb_mtp_targets()?, Some(&token))?;
    Ok((device, token))
}

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
    pub target_id: String,
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
    let (device, target_id) = open_usb_mtp_target(None).await?;

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
        target_id,
        device_family: classify_device_family(&manufacturer, &model),
        manufacturer,
        model,
        serial_number: info.serial_number.clone(),
        storages,
        capabilities: if device.supports_upload() {
            vec!["device-info", "storage-info", "list", "download", "upload"]
        } else {
            vec!["device-info", "storage-info", "list", "download"]
        },
        evidence_source: "mtp:usb-target+GetDeviceInfo+GetStorageInfo",
    })
}

#[tauri::command]
pub async fn mtp_list_root(storage_index: usize, target_id: String) -> Result<Vec<MtpRootObject>, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;

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
    target_id: String,
) -> Result<MtpTransferResult, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;

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
    target_id: String,
) -> Result<MtpTransferResult, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;
    if !device.supports_upload() {
        return Err("The observed USB MTP backend does not support upload".to_string());
    }

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
    target_id: String,
) -> Result<Vec<MtpBrowserObject>, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;

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
    target_id: String,
) -> Result<MtpTransferResult, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;

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
    target_id: String,
) -> Result<MtpTransferResult, String> {
    let (device, _) = open_usb_mtp_target(Some(&target_id)).await?;
    if !device.supports_upload() {
        return Err("The observed USB MTP backend does not support upload".to_string());
    }

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

#[cfg(test)]
mod target_tests {
    use super::*;

    // Simulated identities validate selection policy, not physical hardware.
    fn target() -> UsbMtpTarget {
        UsbMtpTarget {
            vendor_id: 0x18d1, product_id: 0x4ee1,
            location_id: u64::MAX - 7, serial: Some("simulated-usb-a".to_string()),
        }
    }

    #[test]
    fn host_storage_without_usb_mtp_cannot_be_selected() {
        assert!(select_usb_mtp_target(&[], None).is_err());
    }

    #[test]
    fn ambiguous_usb_targets_are_blocked_even_with_a_matching_token() {
        let first = target();
        let token = first.token();
        let mut second = first.clone();
        second.serial = Some("simulated-usb-b".to_string());
        assert!(select_usb_mtp_target(&[first, second], Some(&token)).is_err());
    }

    #[test]
    fn usb_identity_requires_a_nonempty_stable_serial() {
        for serial in [None, Some(String::new()), Some("  ".to_string())] {
            let mut device = target();
            device.serial = serial;
            assert!(select_usb_mtp_target(&[device], None).is_err());
        }
    }

    #[test]
    fn exact_observed_target_is_required_for_reopening() {
        let targets = [target()];
        let token = targets[0].token();
        assert_eq!(token.len(), 64);
        assert!(select_usb_mtp_target(&targets, Some(&token)).is_ok());
        for invalid in ["", "not-a-target", &"0".repeat(64), &token.to_uppercase()] {
            assert!(select_usb_mtp_target(&targets, Some(invalid)).is_err());
        }
    }

    #[test]
    fn changed_usb_identity_cannot_reuse_an_old_session() {
        let original = target();
        let token = original.token();
        for field in 0..4 {
            let mut changed = original.clone();
            match field {
                0 => changed.vendor_id += 1,
                1 => changed.product_id += 1,
                2 => changed.location_id -= 1,
                _ => changed.serial = Some("simulated-usb-b".to_string()),
            }
            assert_ne!(changed.token(), token);
            assert!(select_usb_mtp_target(&[changed], Some(&token)).is_err());
        }
    }
}
