use thiserror::Error;

#[derive(Debug, Error)]
pub enum RenderError {
    #[error("Device initialization error: {0}")]
    DeviceInit(String),
    
    #[error("Swapchain initialization error: {0}")]
    SwapchainInit(String),
    
    #[error("Render graph error: {0}")]
    RenderGraph(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, RenderError>;
