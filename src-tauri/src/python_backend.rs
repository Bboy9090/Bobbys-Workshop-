// Python Backend Launcher
// Manages Python worker process lifecycle

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::path::PathBuf;
use std::io::{BufRead, BufReader};
use anyhow::{Result, Context};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static PY_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Launch Python backend service
pub fn launch_python_backend(app_dir: &PathBuf) -> Result<u16> {
    // Find Python executable in bundled resources
    let python_path = find_python_executable(app_dir)?;
    let script_path = app_dir.join("python").join("app").join("main.py");
    
    if !script_path.exists() {
        anyhow::bail!("Python service script not found: {:?}", script_path);
    }
    
    // Pick a free port
    let port = pick_free_port()?;
    
    // Start Python service
    let mut cmd = Command::new(&python_path);
    cmd.arg(&script_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--policy-mode")
        .arg("public");
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    // Capture stdout to read port (if Python prints it)
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let mut child = cmd.spawn()
        .context("Failed to spawn Python backend")?;
    
    // Read port from stdout (Python prints it)
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        if let Some(Ok(line)) = reader.lines().next() {
            if let Ok(parsed_port) = line.trim().parse::<u16>() {
                // Python printed the port, use it
                let port = parsed_port;
                *PY_PROCESS.lock().unwrap() = Some(child);
                return Ok(port);
            }
        }
    }
    
    // If Python didn't print port, use the one we passed
    *PY_PROCESS.lock().unwrap() = Some(child);
    Ok(port)
}

/// Shutdown Python backend service
pub fn shutdown_python_backend() {
    if let Some(mut child) = PY_PROCESS.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Find Python executable in bundled resources
fn find_python_executable(app_dir: &PathBuf) -> Result<PathBuf> {
    // Check bundled Python runtime
    #[cfg(target_os = "windows")]
    let python_exe = app_dir.join("python").join("python.exe");
    
    #[cfg(not(target_os = "windows"))]
    let python_exe = app_dir.join("python").join("bin").join("python3");
    
    if python_exe.exists() {
        return Ok(python_exe);
    }
    
    // Fallback to system Python (development only)
    #[cfg(target_os = "windows")]
    {
        // Try python.exe in PATH
        let mut cmd = Command::new("python");
        cmd.arg("--version");
        cmd.creation_flags(0x08000000);
        if cmd.output().is_ok() {
            return Ok(PathBuf::from("python"));
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Try python3 in PATH
        let mut cmd = Command::new("python3");
        cmd.arg("--version");
        if cmd.output().is_ok() {
            return Ok(PathBuf::from("python3"));
        }
    }
    
    anyhow::bail!("Python executable not found. Bundled Python missing and system Python not available.");
}

/// Pick a free port
fn pick_free_port() -> Result<u16> {
    use std::net::TcpListener;
    let listener = TcpListener::bind("127.0.0.1:0")
        .context("Failed to bind to localhost")?;
    let port = listener.local_addr()?
        .port();
    Ok(port)
}
