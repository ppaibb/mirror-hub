# Deploy static frontend

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/mirror-hub-frontend}
SRC_DIR=${SRC_DIR:-frontend}
RELEASE=${RELEASE:-$(date +%Y%m%d%H%M%S)}

cd "$(dirname "$0")/.."

npm --prefix "$SRC_DIR" install
npm --prefix "$SRC_DIR" run build

sudo mkdir -p "$APP_DIR/releases/$RELEASE"
sudo rsync -a --delete "$SRC_DIR/out/" "$APP_DIR/releases/$RELEASE/"
sudo ln -sfn "$APP_DIR/releases/$RELEASE" "$APP_DIR/current"

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "$APP_DIR/releases/$RELEASE"
```

Save as a real script and adjust paths for your host if needed.
