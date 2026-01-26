// Python Backend HTTP Client
// Rust client for communicating with Python worker service

use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use std::time::Duration;

#[derive(Serialize)]
pub struct PyInspectRequest<T> {
    pub device_id: String,
    pub platform: String,
    pub payload: T,
}

#[derive(Deserialize)]
pub struct PyResponse<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub warnings: Vec<String>,
}

#[derive(Deserialize, Default)]
pub struct InspectFlags {
    pub activation_locked: Option<bool>,
    pub mdm_enrolled: Option<bool>,
    pub frp_locked: Option<bool>,
    pub efi_locked: Option<bool>,
}

#[derive(Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_ms: u64,
}

/// Python worker HTTP client
pub struct PyWorkerClient {
    base_url: String,
    client: reqwest::Client,
}

impl PyWorkerClient {
    /// Create new Python worker client
    pub fn new(port: u16) -> Self {
        Self {
            base_url: format!("http://127.0.0.1:{}", port),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Check Python backend health
    pub async fn health(&self) -> Result<HealthResponse> {
        let url = format!("{}/health", self.base_url);
        let res = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to connect to Python backend")?;

        if !res.status().is_success() {
            anyhow::bail!("Python backend unhealthy: HTTP {}", res.status());
        }

        let health: HealthResponse = res.json().await
            .context("Failed to parse health response")?;

        Ok(health)
    }

    /// Basic device inspection
    pub async fn inspect_basic(
        &self,
        device_id: &str,
        platform: &str,
    ) -> Result<InspectFlags> {
        let req = PyInspectRequest {
            device_id: device_id.to_string(),
            platform: platform.to_string(),
            payload: serde_json::json!({
                "hints": {
                    "connection": "usb"
                }
            }),
        };

        let url = format!("{}/inspect/basic", self.base_url);
        let res = self.client
            .post(&url)
            .json(&req)
            .send()
            .await
            .context("Failed to send inspect request")?;

        if !res.status().is_success() {
            anyhow::bail!("Inspect failed: HTTP {}", res.status());
        }

        let py_res: PyResponse<InspectFlags> = res.json().await
            .context("Failed to parse inspect response")?;

        if !py_res.ok {
            anyhow::bail!("Inspect returned error");
        }

        Ok(py_res.data.unwrap_or_default())
    }

    /// Deep device inspection
    pub async fn inspect_deep(
        &self,
        device_id: &str,
        platform: &str,
    ) -> Result<serde_json::Value> {
        let req = PyInspectRequest {
            device_id: device_id.to_string(),
            platform: platform.to_string(),
            payload: serde_json::json!({}),
        };

        let url = format!("{}/inspect/deep", self.base_url);
        let res = self.client
            .post(&url)
            .json(&req)
            .send()
            .await
            .context("Failed to send deep inspect request")?;

        if !res.status().is_success() {
            anyhow::bail!("Deep inspect failed: HTTP {}", res.status());
        }

        let py_res: PyResponse<serde_json::Value> = res.json().await
            .context("Failed to parse deep inspect response")?;

        if !py_res.ok {
            anyhow::bail!("Deep inspect returned error");
        }

        Ok(py_res.data.unwrap_or(serde_json::json!({})))
    }
}
