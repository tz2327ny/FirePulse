#!/bin/bash
set -euo pipefail

# ============================================================
# FirePulse Pi Setup
# Clones repo, installs deps, sets up DB, builds, and deploys
# directly to /opt/firepulse where the systemd service runs.
#
# Usage:
#   bash pi-setup.sh            # fresh install
#   bash pi-setup.sh --update   # pull latest + rebuild
# ============================================================

REPO="https://github.com/tz2327ny/FirePulse.git"
BUILD_DIR="/tmp/firepulse-build"
APP_DIR="/opt/firepulse"
DATA_DIR="/opt/firepulse/data"

MODE="install"
if [ "${1:-}" = "--update" ]; then
  MODE="update"
fi

echo "========================================"
echo " FirePulse Pi Setup (${MODE})"
echo "========================================"

if [ "$MODE" = "update" ]; then
  # ── Update mode: pull latest into /opt/firepulse and rebuild in-place ──
  echo "[1/4] Pulling latest code..."
  cd "$APP_DIR"
  sudo -u firepulse git pull

  echo "[2/4] Installing dependencies..."
  sudo -u firepulse npm install

  echo "[3/4] Running database migrations..."
  cd "$APP_DIR/packages/backend"
  sudo -u firepulse npx prisma db push

  echo "[4/4] Building..."
  cd "$APP_DIR"
  sudo -u firepulse npm run build

else
  # ── Fresh install: clone to temp dir, build, deploy to /opt ──

  # Step 1: Clone
  echo "[1/7] Cloning repository..."
  rm -rf "$BUILD_DIR"
  git clone "$REPO" "$BUILD_DIR"

  # Step 2: Install dependencies
  echo "[2/7] Installing npm dependencies (5-10 min on Pi)..."
  cd "$BUILD_DIR"
  npm install

  # Step 3: Create .env
  echo "[3/7] Setting up environment..."
  cat > "$BUILD_DIR/packages/backend/.env" <<EOF
DATABASE_URL=file:${DATA_DIR}/firepulse.db
JWT_SECRET=firepulse-appliance-local
EOF

  # Step 4: Generate Prisma client
  echo "[4/7] Generating Prisma client..."
  cd "$BUILD_DIR/packages/backend"
  npx prisma generate

  # Step 5: Build
  echo "[5/7] Building all packages..."
  cd "$BUILD_DIR"
  npm run build

  # Step 6: Deploy to /opt/firepulse
  echo "[6/7] Deploying to ${APP_DIR}..."
  sudo mkdir -p "$DATA_DIR"
  sudo rsync -a --delete --exclude='data/' "$BUILD_DIR/" "$APP_DIR/"
  sudo chown -R firepulse:firepulse "$APP_DIR"

  # Step 7: Set up database
  echo "[7/7] Setting up database..."
  cd "$APP_DIR/packages/backend"
  sudo -u firepulse npx prisma db push
  sudo -u firepulse npx prisma db seed

  # Cleanup temp build dir
  rm -rf "$BUILD_DIR"
fi

# Restart service
echo ""
echo "Restarting firepulse service..."
sudo systemctl restart firepulse

echo ""
echo "========================================"
echo " FirePulse Setup Complete!"
echo "========================================"
echo " Dashboard: https://firepulse.local:9090"
echo " Logs:      journalctl -u firepulse -f"
echo "========================================"
