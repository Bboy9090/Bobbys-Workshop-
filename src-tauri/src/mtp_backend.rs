use mtp_rs::mtp::MtpDevice;
use serde::Serialize;

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
