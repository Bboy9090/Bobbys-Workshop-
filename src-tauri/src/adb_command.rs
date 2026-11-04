//! Consistent ADB transport selection for macOS Samsung USB interfaces.
//! ADB_LIBUSB=1 prevents the macOS native USB interface plug-in failure
//! seen with SamsungComposite (e00002be). No system driver is modified.
use std::process::Command;

pub fn new_adb_command() -> Command {
    let mut command = Command::new("adb");
    #[cfg(target_os = "macos")]
    command.env("ADB_LIBUSB", "1");
    command
}

#[cfg(test)]
mod tests {
    #[test]
    fn adb_command_uses_expected_executable() {
        let command = super::new_adb_command();
        assert_eq!(command.get_program(), "adb");
        #[cfg(target_os = "macos")]
        assert!(command.get_envs().any(|(key, value)| key == "ADB_LIBUSB" && value == Some(std::ffi::OsStr::new("1"))));
    }
}
