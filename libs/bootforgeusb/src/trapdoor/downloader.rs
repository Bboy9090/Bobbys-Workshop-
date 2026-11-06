//! Automatic tool downloader module.
//! Manages download sources and verifies local installation state for trapdoor tools.

use super::TrapdoorTool;
use crate::{BootForgeUsbError, Result};
use std::fs;
use std::path::PathBuf;

/// Tool download source
#[derive(Debug, Clone)]
pub struct ToolSource {
    pub tool: TrapdoorTool,
    pub url: String,
    pub version: String,
    pub sha256: Option<String>,
}

/// Tool downloader
pub struct ToolDownloader {
    download_dir: PathBuf,
    sources: Vec<ToolSource>,
}

impl ToolDownloader {
    /// Create a new downloader with specified download directory
    pub fn new(download_dir: PathBuf) -> Self {
        Self {
            download_dir,
            sources: Self::default_sources(),
        }
    }

    /// Get default tool sources
    fn default_sources() -> Vec<ToolSource> {
        vec![]
    }

    /// Add a custom tool source
    pub fn add_source(&mut self, source: ToolSource) {
        self.sources.push(source);
    }

    /// Get source for a tool
    pub fn get_source(&self, tool: &TrapdoorTool) -> Option<&ToolSource> {
        self.sources.iter().find(|source| &source.tool == tool)
    }

    /// Prepare category directory and verify local tool presence
    pub fn download_tool(&self, tool: &TrapdoorTool) -> Result<PathBuf> {
        let source = self.get_source(tool).ok_or_else(|| {
            BootForgeUsbError::Trapdoor(format!("No source found for tool: {}", tool.name()))
        })?;

        log::info!("Preparing tool {} from {}", tool.name(), source.url);

        let category_dir = self.download_dir.join(tool.category());
        fs::create_dir_all(&category_dir).map_err(|e| {
            BootForgeUsbError::Trapdoor(format!("Failed to create directory: {}", e))
        })?;

        let target_path = self.get_tool_path(tool);
        if target_path.exists() {
            return Ok(target_path);
        }

        Err(BootForgeUsbError::Trapdoor(
            "Remote binary fetch requires manual installation into the verified tools directory."
                .to_string(),
        ))
    }

    /// Check if a tool is already downloaded
    pub fn is_downloaded(&self, tool: &TrapdoorTool) -> bool {
        let tool_path = self.download_dir.join(tool.category()).join(tool.name());
        tool_path.exists()
    }

    /// Get the expected path for a downloaded tool
    pub fn get_tool_path(&self, tool: &TrapdoorTool) -> PathBuf {
        self.download_dir.join(tool.category()).join(tool.name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_downloader_creation() {
        let temp_dir = TempDir::new().unwrap();
        let downloader = ToolDownloader::new(temp_dir.path().to_path_buf());

        assert_eq!(downloader.download_dir, temp_dir.path());
    }

    #[test]
    fn test_add_source() {
        let temp_dir = TempDir::new().unwrap();
        let mut downloader = ToolDownloader::new(temp_dir.path().to_path_buf());

        let source = ToolSource {
            tool: TrapdoorTool::Palera1n,
            url: "https://example.com/palera1n".to_string(),
            version: "1.0.0".to_string(),
            sha256: Some("abc123".to_string()),
        };

        downloader.add_source(source);

        let found = downloader.get_source(&TrapdoorTool::Palera1n);
        assert!(found.is_some());
        assert_eq!(found.unwrap().version, "1.0.0");
    }

    #[test]
    fn test_is_downloaded() {
        let temp_dir = TempDir::new().unwrap();
        let downloader = ToolDownloader::new(temp_dir.path().to_path_buf());

        assert!(!downloader.is_downloaded(&TrapdoorTool::Palera1n));

        let tool_dir = temp_dir.path().join("ios_old");
        fs::create_dir_all(&tool_dir).unwrap();
        fs::write(tool_dir.join("palera1n"), b"verified binary").unwrap();

        assert!(downloader.is_downloaded(&TrapdoorTool::Palera1n));
    }

    #[test]
    fn test_get_tool_path() {
        let temp_dir = TempDir::new().unwrap();
        let downloader = ToolDownloader::new(temp_dir.path().to_path_buf());

        let path = downloader.get_tool_path(&TrapdoorTool::Palera1n);
        assert_eq!(path, temp_dir.path().join("ios_old").join("palera1n"));
    }
}
