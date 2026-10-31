#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="BobFWTools"
EXEC_NAME="BobFWTools"
BUILD_ROOT="/tmp/BobFWTools_build"
rm -rf "${BUILD_ROOT}"
mkdir -p "${BUILD_ROOT}"

APP_BUNDLE="${BUILD_ROOT}/${APP_NAME}.app"
CONTENTS_DIR="${APP_BUNDLE}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
FRAMEWORKS_DIR="${CONTENTS_DIR}/Frameworks"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
mkdir -p /tmp/swift-module-cache
export SWIFT_MODULE_CACHE_PATH="/tmp/swift-module-cache"
export CLANG_MODULE_CACHE_PATH="/tmp/swift-module-cache"
BOOTFORGE_BIN="${PROJECT_DIR}/tools/bootforgeusb"
ENTITLEMENTS_PLIST="${PROJECT_DIR}/entitlements.plist"

rm -rf "${APP_BUNDLE}"
mkdir -p "${MACOS_DIR}" "${FRAMEWORKS_DIR}" "${RESOURCES_DIR}"

echo "[1/5] Generating Store-Compliant Info.plist & entitlements.plist..."
cat > "${CONTENTS_DIR}/Info.plist" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>${EXEC_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.bobbyblanco.bobfwtools.studio</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>BobFWTools</string>
    <key>CFBundleDisplayName</key>
    <string>BobFWTools Studio</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>5.0.0</string>
    <key>CFBundleVersion</key>
    <string>500</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>ITSAppUsesNonExemptEncryption</key>
    <false/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 Bobby's Workshop — Phoenix Forge. All rights reserved.</string>
    <key>NSUSBUsageDescription</key>
    <string>BobFWTools communicates with connected USB mobile devices for hardware diagnostics, telemetry verification, and authorized firmware servicing.</string>
    <key>NSDownloadsFolderUsageDescription</key>
    <string>BobFWTools inspects official firmware archives in your Downloads folder for SHA-256 verification and anti-rollback binary matching.</string>
</dict>
</plist>
PLIST_EOF

cat > "${RESOURCES_DIR}/PrivacyInfo.xcprivacy" <<PRIV_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>E174.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>DDA9.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PRIV_EOF

cat > "${ENTITLEMENTS_PLIST}" <<ENT_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.usb</key>
    <true/>
    <key>com.apple.security.device.serial</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
ENT_EOF

ENTITLEMENTS_STORE_PLIST="${PROJECT_DIR}/entitlements.store.plist"
ENTITLEMENTS_HELPER_PLIST="${PROJECT_DIR}/entitlements.helper.plist"

cat > "${ENTITLEMENTS_STORE_PLIST}" <<STORE_ENT_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.device.usb</key>
    <true/>
    <key>com.apple.security.device.serial</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
STORE_ENT_EOF

cat > "${ENTITLEMENTS_HELPER_PLIST}" <<HELPER_ENT_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.inherit</key>
    <true/>
</dict>
</plist>
HELPER_ENT_EOF

echo "[2/5] Installing AppIcon.icns..."
if [ -f "${PROJECT_DIR}/store_packaging/macos/AppIcon.icns" ]; then
    cp "${PROJECT_DIR}/store_packaging/macos/AppIcon.icns" "${RESOURCES_DIR}/AppIcon.icns"
fi

echo "[3/5] Bundling native Rust BootForge USB engine, ADB/Fastboot/Heimdall & self-contained libusb dylib..."
if [ -f "${PROJECT_DIR}/tools/bootforgeusb" ]; then
    cp "${PROJECT_DIR}/tools/bootforgeusb" "${MACOS_DIR}/bootforgeusb"
    chmod +x "${MACOS_DIR}/bootforgeusb"
elif [ -f "${BOOTFORGE_BIN}" ]; then
    cp "${BOOTFORGE_BIN}" "${MACOS_DIR}/bootforgeusb"
    chmod +x "${MACOS_DIR}/bootforgeusb"
fi

if [ -f "${PROJECT_DIR}/tools/libusb-1.0.0.dylib" ]; then
    cp "${PROJECT_DIR}/tools/libusb-1.0.0.dylib" "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib"
    chmod 755 "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib"
elif [ -f "/usr/local/opt/libusb/lib/libusb-1.0.0.dylib" ]; then
    cp "/usr/local/opt/libusb/lib/libusb-1.0.0.dylib" "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib" 2>/dev/null || true
    chmod 755 "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib" 2>/dev/null || true
fi

if [ -f "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib" ] && [ -f "${MACOS_DIR}/bootforgeusb" ]; then
    install_name_tool -id "@executable_path/../Frameworks/libusb-1.0.0.dylib" "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib" 2>/dev/null || true
    install_name_tool -change "/usr/local/opt/libusb/lib/libusb-1.0.0.dylib" "@executable_path/../Frameworks/libusb-1.0.0.dylib" "${MACOS_DIR}/bootforgeusb" 2>/dev/null || true
fi

for TOOL in adb fastboot heimdall; do
    if [ -f "${PROJECT_DIR}/tools/${TOOL}" ]; then
        cp "${PROJECT_DIR}/tools/${TOOL}" "${MACOS_DIR}/${TOOL}"
        chmod +x "${MACOS_DIR}/${TOOL}"
    elif [ -f "/usr/local/bin/${TOOL}" ]; then
        cp -L "/usr/local/bin/${TOOL}" "${MACOS_DIR}/${TOOL}" 2>/dev/null || true
        chmod +x "${MACOS_DIR}/${TOOL}" 2>/dev/null || true
    fi
done

echo "[4/5] Compiling Swift sources into Universal 2 (x86_64 + arm64) native macOS binary..."
swiftc \
    -O \
    -module-cache-path /tmp/swift-module-cache \
    -target x86_64-apple-macos14.0 \
    -parse-as-library \
    "${PROJECT_DIR}/Sources/ServicingEngine.swift" \
    "${PROJECT_DIR}/Sources/MainViews.swift" \
    "${PROJECT_DIR}/Sources/AppMain.swift" \
    -o "${MACOS_DIR}/${EXEC_NAME}_x86_64"

swiftc \
    -O \
    -module-cache-path /tmp/swift-module-cache \
    -target arm64-apple-macos14.0 \
    -parse-as-library \
    "${PROJECT_DIR}/Sources/ServicingEngine.swift" \
    "${PROJECT_DIR}/Sources/MainViews.swift" \
    "${PROJECT_DIR}/Sources/AppMain.swift" \
    -o "${MACOS_DIR}/${EXEC_NAME}_arm64"

lipo -create -output "${MACOS_DIR}/${EXEC_NAME}" "${MACOS_DIR}/${EXEC_NAME}_x86_64" "${MACOS_DIR}/${EXEC_NAME}_arm64"
rm -f "${MACOS_DIR}/${EXEC_NAME}_x86_64" "${MACOS_DIR}/${EXEC_NAME}_arm64"

echo "[5/6] Signing (inside-out Hardened Runtime + Unrestricted Owner Entitlements) and packaging YOUR Private Standalone Owner Copy..."
find "${APP_BUNDLE}" -name "._*" -delete 2>/dev/null || true
xattr -c "${APP_BUNDLE}" 2>/dev/null || true
xattr -cr "${APP_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.FinderInfo "${APP_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.fileprovider.fpfs#P "${APP_BUNDLE}" 2>/dev/null || true
if [ -f "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib" ]; then
    codesign --force --sign - --options runtime "${FRAMEWORKS_DIR}/libusb-1.0.0.dylib"
fi
for TOOL in bootforgeusb adb fastboot heimdall; do
    if [ -f "${MACOS_DIR}/${TOOL}" ]; then
        codesign --force --sign - --options runtime "${MACOS_DIR}/${TOOL}"
    fi
done
find "${APP_BUNDLE}" -name "._*" -delete 2>/dev/null || true
xattr -c "${APP_BUNDLE}" 2>/dev/null || true
xattr -cr "${APP_BUNDLE}" 2>/dev/null || true
codesign --force --sign - --options runtime --entitlements "${ENTITLEMENTS_PLIST}" "${APP_BUNDLE}"

OWNER_DIST_DIR="${PROJECT_DIR}/dist/Owner-Private-Only"
rm -rf "${OWNER_DIST_DIR}" "${PROJECT_DIR}/${APP_NAME}.app"
mkdir -p "${OWNER_DIST_DIR}"
chmod 700 "${OWNER_DIST_DIR}"
cp -R "${APP_BUNDLE}" "${OWNER_DIST_DIR}/${APP_NAME}.app"
cp -R "${APP_BUNDLE}" "${PROJECT_DIR}/${APP_NAME}.app"
ditto -c -k --sequesterRsrc --keepParent "${APP_BUNDLE}" "${OWNER_DIST_DIR}/BobFWTools-Owner-Private-macOS.zip"
chmod 600 "${OWNER_DIST_DIR}/BobFWTools-Owner-Private-macOS.zip"

killall "${APP_NAME}" 2>/dev/null || true
sleep 1
if rm -rf "/Applications/${APP_NAME}.app" 2>/dev/null && cp -R "${APP_BUNDLE}" "/Applications/${APP_NAME}.app" 2>/dev/null; then
    echo "Installed update to /Applications/${APP_NAME}.app"
else
    echo "Preserved local app in ${OWNER_DIST_DIR}/${APP_NAME}.app"
fi

echo "[6/6] Compiling & packaging SEPARATE Public Store Submission Edition (-DSTORE_EDITION, zero Owner code)..."
STORE_DIST_DIR="${PROJECT_DIR}/dist/Store-Submission"
STORE_BUILD_DIR="${BUILD_ROOT}/store_build"
STORE_BUNDLE="${STORE_BUILD_DIR}/${APP_NAME}.app"
rm -rf "${STORE_DIST_DIR}" "${STORE_BUILD_DIR}"
mkdir -p "${STORE_DIST_DIR}" "${STORE_BUILD_DIR}"
cp -R "${APP_BUNDLE}" "${STORE_BUNDLE}"

swiftc \
    -O \
    -module-cache-path /tmp/swift-module-cache \
    -DSTORE_EDITION \
    -target x86_64-apple-macos14.0 \
    -parse-as-library \
    "${PROJECT_DIR}/Sources/ServicingEngine.swift" \
    "${PROJECT_DIR}/Sources/MainViews.swift" \
    "${PROJECT_DIR}/Sources/AppMain.swift" \
    -o "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_x86_64"

swiftc \
    -O \
    -module-cache-path /tmp/swift-module-cache \
    -DSTORE_EDITION \
    -target arm64-apple-macos14.0 \
    -parse-as-library \
    "${PROJECT_DIR}/Sources/ServicingEngine.swift" \
    "${PROJECT_DIR}/Sources/MainViews.swift" \
    "${PROJECT_DIR}/Sources/AppMain.swift" \
    -o "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_arm64"

lipo -create -output "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}" "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_x86_64" "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_arm64"
rm -f "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_x86_64" "${STORE_BUNDLE}/Contents/MacOS/${EXEC_NAME}_arm64"

find "${STORE_BUNDLE}" -name "._*" -delete 2>/dev/null || true
xattr -c "${STORE_BUNDLE}" 2>/dev/null || true
xattr -cr "${STORE_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.FinderInfo "${STORE_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.fileprovider.fpfs#P "${STORE_BUNDLE}" 2>/dev/null || true
for TOOL in bootforgeusb adb fastboot heimdall; do
    if [ -f "${STORE_BUNDLE}/Contents/MacOS/${TOOL}" ]; then
        codesign --force --sign - --options runtime --entitlements "${ENTITLEMENTS_HELPER_PLIST}" "${STORE_BUNDLE}/Contents/MacOS/${TOOL}"
    fi
done
find "${STORE_BUNDLE}" -name "._*" -delete 2>/dev/null || true
xattr -c "${STORE_BUNDLE}" 2>/dev/null || true
xattr -cr "${STORE_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.FinderInfo "${STORE_BUNDLE}" 2>/dev/null || true
xattr -d com.apple.fileprovider.fpfs#P "${STORE_BUNDLE}" 2>/dev/null || true
codesign --force --sign - --options runtime --entitlements "${ENTITLEMENTS_STORE_PLIST}" "${STORE_BUNDLE}"
cp -R "${STORE_BUNDLE}" "${STORE_DIST_DIR}/${APP_NAME}.app"
ditto -c -k --sequesterRsrc --keepParent "${STORE_BUNDLE}" "${STORE_DIST_DIR}/BobFWTools-Store-Submission-macOS.zip"

echo "Build complete:"
echo "  1. Owner Private Installed App : /Applications/BobFWTools.app"
echo "  2. Owner Private Standalone Zip: ${OWNER_DIST_DIR}/BobFWTools-Owner-Private-macOS.zip"
echo "  3. Public Store Submission Zip : ${STORE_DIST_DIR}/BobFWTools-Store-Submission-macOS.zip"
