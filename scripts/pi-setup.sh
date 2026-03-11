#!/bin/bash
set -euo pipefail

# ============================================================
# FirePulse Pi Dev Setup
# Clones repo, installs deps, sets up DB, builds, and restarts.
# Usage: curl/wget this script and run, OR:
#   cd ~ && rm -rf FirePulse && bash FirePulse-setup.sh
# ============================================================

REPO="https://github.com/tz2327ny/FirePulse.git"
APP_DIR="$HOME/FirePulse"

echo "========================================"
echo " FirePulse Dev Setup"
echo "========================================"

# Step 1: Clone
if [ -d "$APP_DIR" ]; then
  echo "[1/6] Removing existing FirePulse directory..."
  rm -rf "$APP_DIR"
fi
echo "[1/6] Cloning repository..."
git clone "$REPO" "$APP_DIR"

# Step 2: Install dependencies
echo "[2/6] Installing npm dependencies (this takes 5-10 min on Pi)..."
cd "$APP_DIR"
npm install

# Step 3: Create .env if missing
echo "[3/6] Setting up environment..."
ENV_FILE="$APP_DIR/packages/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "  Creating packages/backend/.env..."
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=file:./data/firepulse.db
JWT_SECRET=dev-secret-change-in-production
EOF
else
  echo "  .env already exists, skipping."
fi

# Step 4: Database setup
echo "[4/6] Setting up database..."
cd "$APP_DIR/packages/backend"
mkdir -p data
npx prisma db push
npx prisma db seed

# Step 5: Build
echo "[5/6] Building all packages..."
cd "$APP_DIR"
npm run build

# Step 6: Restart service
echo "[6/6] Restarting firepulse service..."
if systemctl is-active --quiet firepulse 2>/dev/null; then
  sudo systemctl restart firepulse
  echo "  Service restarted."
else
  echo "  firepulse service not found — skipping restart."
  echo "  Start manually: node packages/backend/dist/server.js"
fi

echo ""
echo "========================================"
echo " FirePulse Setup Complete!"
echo "========================================"
echo " Dashboard: https://firepulse.local:9090"
echo " Logs:      journalctl -u firepulse -f"
echo "========================================"
