// FastAPI Backend Launcher
// Starts the FastAPI backend for Secret Rooms

use std::process::{Command, Child, Stdio};
use std::path::PathBuf;
use tauri::AppHandle;
use std::io::Error;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Find Python executable (bundled first, then system)
fn find_python_executable(app_handle: &AppHandle) -> Option<PathBuf> {
    // Try bundled Python first
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let bundled_python = resource_dir
            .join("python")
            .join("runtime")
            .join("python-embedded")
            .join(if cfg!(target_os = "windows") {
                "python.exe"
            } else {
                "bin/python3"
            });
        
        if bundled_python.exists() {
            println!("[FastAPI] Using bundled Python: {:?}", bundled_python);
            return Some(bundled_python);
        }
    }
    
    // Fallback to system Python
    #[cfg(target_os = "windows")]
    {
        // Try common Python locations on Windows
        let common_paths = vec![
            "C:\\Python312\\python.exe",
            "C:\\Python311\\python.exe",
            "C:\\Python310\\python.exe",
            "C:\\Program Files\\Python312\\python.exe",
            "C:\\Program Files\\Python311\\python.exe",
        ];
        
        for path in common_paths {
            let python_path = PathBuf::from(path);
            if python_path.exists() {
                println!("[FastAPI] Using system Python: {:?}", python_path);
                return Some(python_path);
            }
        }
    }
    
    // Try PATH
    if let Ok(output) = Command::new(if cfg!(target_os = "windows") { "python" } else { "python3" })
        .arg("--version")
        .output()
    {
        if output.status.success() {
            let python_cmd = if cfg!(target_os = "windows") { "python" } else { "python3" };
            println!("[FastAPI] Using system Python from PATH: {}", python_cmd);
            return Some(PathBuf::from(python_cmd));
        }
    }
    
    None
}

/// Launch FastAPI backend
pub fn launch_fastapi_backend(app_handle: &AppHandle) -> Result<Child, Error> {
    println!("[FastAPI] Starting FastAPI backend...");
    
    // Find Python executable
    let python_exe = match find_python_executable(app_handle) {
        Some(exe) => exe,
        None => {
            return Err(Error::new(
                std::io::ErrorKind::NotFound,
                "Python executable not found. Bundled Python missing and system Python not installed."
            ));
        }
    };
    
    // Get resource directory
    let resource_dir = match app_handle.path().resource_dir() {
        Ok(dir) => dir,
        Err(_) => {
            // Fallback to executable directory
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    exe_dir.to_path_buf()
                } else {
                    return Err(Error::new(
                        std::io::ErrorKind::NotFound,
                        "Could not determine resource directory"
                    ));
                }
            } else {
                return Err(Error::new(
                    std::io::ErrorKind::NotFound,
                    "Could not determine executable path"
                ));
            }
        }
    };
    
    // Find backend directory (FastAPI backend)
    let mut backend_dir = resource_dir
        .join("python")
        .join("fastapi_backend");
    
    // Fallback to old path for compatibility
    if !backend_dir.exists() {
        let old_backend_dir = resource_dir
            .join("python")
            .join("runtime")
            .join("python-embedded")
            .join("backend");
        if old_backend_dir.exists() {
            // Use old path if new path doesn't exist
            backend_dir = old_backend_dir;
        } else {
            return Err(Error::new(
                std::io::ErrorKind::NotFound,
                format!("FastAPI backend directory not found. Expected: {:?} or {:?}", 
                    resource_dir.join("python").join("fastapi_backend"),
                    old_backend_dir)
            ));
        }
    }
    
    // Port for FastAPI
    let port = std::env::var("FASTAPI_PORT")
        .unwrap_or_else(|_| "8000".to_string())
        .parse::<u16>()
        .unwrap_or(8000);
    
    println!("[FastAPI] Backend directory: {:?}", backend_dir);
    println!("[FastAPI] Starting on port {}", port);
    
    // Build command
    let mut cmd = Command::new(&python_exe);
    
    // Set working directory
    cmd.current_dir(&backend_dir);
    
    // Set environment variables
    cmd.env("FASTAPI_PORT", port.to_string());
    cmd.env("SECRET_ROOM_PASSCODE", std::env::var("SECRET_ROOM_PASSCODE").unwrap_or_else(|_| "".to_string()));
    
    // Set PYTHONPATH
    let pythonpath = format!("{}:{}", 
        backend_dir.parent().unwrap().to_string_lossy(),
        std::env::var("PYTHONPATH").unwrap_or_else(|_| "".to_string())
    );
    cmd.env("PYTHONPATH", pythonpath);
    
    // Run uvicorn (main.py is in fastapi_backend directory)
    cmd.arg("-m")
        .arg("uvicorn")
        .arg("main:app")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string());
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    // Redirect output to log file
    let log_dir = app_handle.path().app_log_dir().unwrap_or_else(|_| {
        std::env::temp_dir().join("bobbysworkshop")
    });
    std::fs::create_dir_all(&log_dir).ok();
    
    let log_file = log_dir.join("fastapi-backend.log");
    if let Ok(file) = std::fs::File::create(&log_file) {
        cmd.stdout(Stdio::from(file)).stderr(Stdio::from(file));
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    
    // Spawn process
    let child = cmd.spawn()?;
    
    println!("[FastAPI] FastAPI backend started (PID: {})", child.id());
    println!("[FastAPI] Backend URL: http://127.0.0.1:{}", port);
    
    // Give it time to start
    std::thread::sleep(std::time::Duration::from_secs(2));
    
    Ok(child)
}

/// Shutdown FastAPI backend
pub fn shutdown_fastapi_backend(child: Option<Child>) {
    if let Some(mut child) = child {
        println!("[FastAPI] Stopping FastAPI backend...");
        let _ = child.kill();
        let _ = child.wait();
        println!("[FastAPI] FastAPI backend stopped");
    }
}
