#!/bin/zsh
set -u

APP_PATHS=(
  "/Applications/ScribeFlow.app"
  "$HOME/Applications/ScribeFlow.app"
)

echo "ScribeFlow macOS repair"
echo "Looking for installed app..."
echo

FOUND=0
REPAIRED=0

for APP_PATH in "${APP_PATHS[@]}"; do
  if [[ ! -d "$APP_PATH" ]]; then
    continue
  fi

  FOUND=1
  echo "Found: $APP_PATH"
  echo "Removing quarantine attributes..."

  /usr/bin/xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.provenance "$APP_PATH" 2>/dev/null || true

  if [[ -d "$APP_PATH/Contents/MacOS" ]]; then
    for EXECUTABLE_PATH in "$APP_PATH"/Contents/MacOS/*; do
      [[ -f "$EXECUTABLE_PATH" ]] && /bin/chmod +x "$EXECUTABLE_PATH" 2>/dev/null || true
    done
  fi

  REPAIRED=1
  echo "Repaired: $APP_PATH"
  echo
done

if [[ "$FOUND" -eq 0 ]]; then
  echo "ScribeFlow.app was not found in /Applications or ~/Applications."
  echo "Install ScribeFlow first, then run this command again."
  echo
  echo "This window will close in 8 seconds."
  sleep 8
else
  if [[ "$REPAIRED" -eq 1 ]]; then
    echo "Repair complete. You can open ScribeFlow again."
  else
    echo "Nothing needed to be repaired."
  fi
  echo
  echo "This window will close in 3 seconds."
  sleep 3
fi

osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 &
exit 0
