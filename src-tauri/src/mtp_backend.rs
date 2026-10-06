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
    pub storages: Vec<MtpStorageSummary>,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MtpRootObject {
    pub handle: String,
    pub filename: String,
    pub is_folder: bool,
}

#[tauri::command]
pub async fn mtp_status() -> Result<MtpStatus, String> {
    let device = MtpDevice::open_first()
        .await
        .map_err(|e| format!("No usable MTP device: {e}"))?;

    let info = device.device_info();
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
        manufacturer: info.manufacturer.clone(),
        model: info.model.clone(),
        serial_number: info.serial_number.clone(),
        storages,
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
