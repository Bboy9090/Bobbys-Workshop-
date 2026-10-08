# B.U.Tools Future Handoff

B.U.Tools (Bobby's Utility Tools) is the future flagship general-purpose utility suite. Keep Apple-specific device recovery work out of BobFWTools and move it into B.U.Tools when that project begins.

Reserved B.U.Tools device lane:
- Apple DFU and Recovery-mode USB detection
- IPSW structural inspection (BuildManifest.plist, Restore.plist, restore images)
- Signed Apple restore workflows using legitimate Apple restore/signing services
- Restore progress, post-restore verification, and device compatibility checks

Do not carry BootROM exploit execution, checkm8-style payloads, activation-lock bypass, or other security-bypass workflows into B.U.Tools.

BobFWTools remains focused on Android/service-repair workflows: Samsung Download/Odin, Qualcomm authenticated EDL, MediaTek authenticated Download/Preloader, ADB/Fastboot, firmware inspection, diagnostics, and guarded flash execution.
