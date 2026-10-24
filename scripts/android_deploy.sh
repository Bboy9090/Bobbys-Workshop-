#!/usr/bin/env bash
# Authorized Android deployment. Single-device default; --all is explicit.
set -u
usage() { echo 'Usage: android_deploy.sh [--serial SERIAL | --all] [--apk PATH] [--url HTTPS_URL] [--dry-run]'; }
serial=''; all=0; apk=''; url=''; dry=0
while (($#)); do
 case "$1" in
 --serial) (($#>=2)) || { usage; exit 2; }; serial="$2"; shift 2;;
 --all) all=1; shift;;
 --apk) (($#>=2)) || { usage; exit 2; }; apk="$2"; shift 2;;
 --url) (($#>=2)) || { usage; exit 2; }; url="$2"; shift 2;;
 --dry-run) dry=1; shift;;
 *) usage; exit 2;;
 esac
done
((all==0)) || [[ -z "$serial" ]] || { echo 'Choose --all or --serial, not both' >&2; exit 2; }
command -v adb >/dev/null || { echo 'adb unavailable' >&2; exit 1; }
[[ -z "$apk" || -f "$apk" ]] || { echo 'APK not found' >&2; exit 2; }
[[ -z "$url" || "$url" =~ ^https://[^[:space:]]+$ ]] || { echo 'URL must be HTTPS' >&2; exit 2; }
mapfile_devices() { adb devices | awk 'NR>1 && $2=="device" {print $1}'; }
if [[ -n "$serial" ]]; then
 devices=(); while IFS= read -r d; do [[ -z "$d" ]] || devices+=("$d"); done < <(mapfile_devices | grep -Fx -- "$serial")
else
 devices=(); while IFS= read -r d; do [[ -z "$d" ]] || devices+=("$d"); done < <(mapfile_devices)
fi
((${#devices[@]}>0)) || { echo 'No matching authorized ADB device' >&2; exit 1; }
if ((all==0 && ${#devices[@]}>1)); then echo 'Multiple devices detected; choose --serial or explicitly --all' >&2; exit 2; fi
if [[ -z "$apk" && -z "$url" ]]; then
 printf 'Authorized device(s): %s\n' "${devices[*]}"
 for d in "${devices[@]}"; do adb -s "$d" shell getprop ro.product.model || exit 1; done
 exit 0
fi
run_one() {
 local d="$1" rc=0
 echo "[$d] Starting"
 if ((dry)); then echo "[$d] DRY RUN apk=${apk:-none} url=${url:-none}"; return 0; fi
 if [[ -n "$apk" ]]; then adb -s "$d" install -r "$apk" || rc=1; fi
 if ((rc==0)) && [[ -n "$url" ]]; then adb -s "$d" shell am start -a android.intent.action.VIEW -d "$url" || rc=1; fi
 if ((rc)); then echo "[$d] FAILED" >&2; else echo "[$d] Commands accepted (on-device outcome not verified)"; fi
 return "$rc"
}
pids=()
for d in "${devices[@]}"; do run_one "$d" & pids+=("$!"); done
failed=0
for p in "${pids[@]}"; do wait "$p" || failed=1; done
if ((failed)); then echo 'Deployment failed on at least one device' >&2; exit 1; fi
echo 'All selected devices accepted commands'
