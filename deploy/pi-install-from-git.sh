#!/bin/bash
set -euo pipefail

# ============================================================
# FirePulse Pi Installer — Install from GitHub
# Clones the repo, builds everything, then runs setup.
#
# Usage (on a fresh Pi):
#   curl -fsSL https://raw.githubusercontent.com/tz2327ny/FirePulse/master/deploy/pi-install-from-git.sh | sudo bash
#
# Or manually:
#   git clone https://github.com/tz2327ny/FirePulse.git
#   cd FirePulse/deploy
#   sudo bash pi-install-from-git.sh
# ============================================================

REPO_URL="https://github.com/tz2327ny/FirePulse.git"
CLONE_DIR="/home/$(logname 2>/dev/null || echo pi)/FirePulse"
APP_DIR="/opt/firepulse"
DATA_DIR="/opt/firepulse/data"

echo "========================================"
echo " FirePulse Pi Installer (from GitHub)"
echo "========================================"

# Must be root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run this script with sudo"
  exit 1
fi

REAL_USER=$(logname 2>/dev/null || echo pi)

# ── Step 1: System packages ──────────────────────────────────
echo ""
echo "[1/10] Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
  git curl hostapd dnsmasq avahi-daemon \
  build-essential python3 > /dev/null

# ── Step 2: Install Node.js 20 LTS ──────────────────────────
echo "[2/10] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
fi
echo "  Node.js $(node -v), npm $(npm -v)"

# ── Step 3: Clone or update repo ────────────────────────────
echo "[3/10] Getting source code..."
if [ -d "$CLONE_DIR/.git" ]; then
  echo "  Updating existing clone at $CLONE_DIR..."
  cd "$CLONE_DIR"
  sudo -u "$REAL_USER" git pull --ff-only
else
  echo "  Cloning from $REPO_URL..."
  sudo -u "$REAL_USER" git clone "$REPO_URL" "$CLONE_DIR"
  cd "$CLONE_DIR"
fi

# ── Step 4: Install all dependencies (need devDeps for build)
echo "[4/10] Installing dependencies (this takes a few minutes on Pi)..."
sudo -u "$REAL_USER" npm install --ignore-scripts 2>&1 | tail -3
# Run postinstall scripts that matter
sudo -u "$REAL_USER" npx prisma generate --schema=packages/backend/prisma/schema.prisma 2>/dev/null || true

# ── Step 5: Build shared package ─────────────────────────────
echo "[5/10] Building shared package..."
sudo -u "$REAL_USER" npm run build:shared

# ── Step 6: Build backend ───────────────────────────────────
echo "[6/10] Building backend..."
sudo -u "$REAL_USER" npm run build:backend

# ── Step 7: Build frontend ──────────────────────────────────
echo "[7/10] Building frontend (Vite — this takes a minute)..."
sudo -u "$REAL_USER" npm run build:frontend

# ── Step 8: Create template database ────────────────────────
echo "[8/10] Creating template database..."
sudo -u "$REAL_USER" npm run build:template 2>/dev/null || {
  echo "  Template DB creation failed, will create empty DB"
}

# ── Step 9: Build appliance package ─────────────────────────
echo "[9/10] Building appliance package..."
sudo -u "$REAL_USER" node scripts/build-appliance.cjs

# ── Step 10: Run appliance setup ────────────────────────────
echo "[10/10] Running appliance setup..."
APPLIANCE_DIR="$CLONE_DIR/deploy/firepulse-appliance"

if [ ! -d "$APPLIANCE_DIR/packages/backend/dist" ]; then
  echo "ERROR: Appliance build failed — backend dist not found"
  exit 1
fi

# ── From here, replicate setup-appliance.sh logic ───────────

# Create firepulse user
echo "  Creating firepulse user..."
if ! id -u firepulse &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" firepulse
fi

# Deploy to /opt/firepulse
echo "  Deploying to $APP_DIR..."
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete \
  --exclude='deploy/' \
  --exclude='data/' \
  "$APPLIANCE_DIR/" "$APP_DIR/"

# Install production deps at deploy location
echo "  Installing production dependencies..."
cd "$APP_DIR"
npm install --omit=dev 2>&1 | tail -1

# Generate Prisma client for ARM64
echo "  Generating Prisma client for $(uname -m)..."
cd "$APP_DIR/packages/backend"
npx prisma generate

# Copy template database if needed
if [ ! -f "$DATA_DIR/firepulse.db" ]; then
  if [ -f "$APPLIANCE_DIR/data/template.db" ]; then
    echo "  Copying template database..."
    cp "$APPLIANCE_DIR/data/template.db" "$DATA_DIR/firepulse.db"
  fi
fi

chown -R firepulse:firepulse "$APP_DIR"

# Install systemd service
echo "  Installing systemd service..."
cp "$CLONE_DIR/deploy/firepulse.service" /etc/systemd/system/firepulse.service
systemctl daemon-reload
systemctl enable firepulse

# ── Configure Wi-Fi hotspot ─────────────────────────────────
HOTSPOT_INTERFACE="wlan0"
echo "  Configuring Wi-Fi hotspot..."

if iw dev | grep -q wlan1; then
  HOTSPOT_INTERFACE="wlan1"
  echo "    Detected USB Wi-Fi adapter, using wlan1"
else
  echo "    Using onboard Wi-Fi (wlan0)"
fi

# Stop wpa_supplicant on hotspot interface
systemctl stop wpa_supplicant 2>/dev/null || true
systemctl disable wpa_supplicant 2>/dev/null || true

# Configure static IP
if [ -f /etc/dhcpcd.conf ]; then
  if ! grep -q "interface ${HOTSPOT_INTERFACE}" /etc/dhcpcd.conf; then
    cat >> /etc/dhcpcd.conf <<EOF

# FirePulse hotspot — static IP
interface ${HOTSPOT_INTERFACE}
  static ip_address=10.0.50.1/24
  nohook wpa_supplicant
EOF
  fi
elif command -v nmcli &> /dev/null; then
  # Tell NetworkManager to ignore the hotspot interface
  mkdir -p /etc/NetworkManager/conf.d
  cat > /etc/NetworkManager/conf.d/99-firepulse.conf <<EOF
[keyfile]
unmanaged-devices=interface-name:${HOTSPOT_INTERFACE}
EOF
  systemctl restart NetworkManager 2>/dev/null || true
  sleep 2
  # Set up interface manually
  rfkill unblock wifi 2>/dev/null || true
  ip link set ${HOTSPOT_INTERFACE} up 2>/dev/null || true
  ip addr flush dev ${HOTSPOT_INTERFACE} 2>/dev/null || true
  ip addr add 10.0.50.1/24 dev ${HOTSPOT_INTERFACE} 2>/dev/null || true

  # Create boot-time service for interface setup
  cat > /etc/systemd/system/firepulse-hotspot.service <<EOF
[Unit]
Description=FirePulse Hotspot Network Setup
Before=hostapd.service dnsmasq.service
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/rfkill unblock wifi
ExecStart=/sbin/ip link set ${HOTSPOT_INTERFACE} up
ExecStart=/sbin/ip addr flush dev ${HOTSPOT_INTERFACE}
ExecStart=/sbin/ip addr add 10.0.50.1/24 dev ${HOTSPOT_INTERFACE}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable firepulse-hotspot
fi

# Install hostapd config
sed "s/interface=wlan0/interface=${HOTSPOT_INTERFACE}/" \
  "$CLONE_DIR/deploy/hostapd.conf" > /etc/hostapd/hostapd.conf
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd

# Install dnsmasq config
sed "s/interface=wlan0/interface=${HOTSPOT_INTERFACE}/" \
  "$CLONE_DIR/deploy/dnsmasq.conf" > /etc/dnsmasq.d/firepulse.conf

# Unmask and enable
systemctl unmask hostapd
systemctl enable hostapd
systemctl enable dnsmasq

# ── Configure mDNS ──────────────────────────────────────────
echo "  Configuring mDNS (firepulse.local)..."
mkdir -p /etc/avahi/services
cat > /etc/avahi/services/firepulse.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>FirePulse</name>
  <service>
    <type>_http._tcp</type>
    <port>3001</port>
  </service>
</service-group>
EOF
hostnamectl set-hostname FirePulse
systemctl enable avahi-daemon

# ── Firewall ────────────────────────────────────────────────
echo "  Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 3001/tcp comment "FirePulse HTTP" 2>/dev/null
  ufw allow 41234/udp comment "FirePulse Telemetry" 2>/dev/null
  ufw allow 67/udp comment "DHCP" 2>/dev/null
  ufw allow 53 comment "DNS" 2>/dev/null
  ufw --force enable 2>/dev/null
fi

# ── Done ────────────────────────────────────────────────────
echo ""
echo "========================================"
echo " FirePulse Installation Complete!"
echo "========================================"
echo ""
echo " Hotspot SSID:     FirePulse"
echo " Hotspot Password: firepulse123"
echo " Interface:        ${HOTSPOT_INTERFACE}"
echo ""
echo " Dashboard:  http://10.0.50.1:3001"
echo "         or  http://firepulse.local:3001"
echo ""
echo " ESP32 UDP:  10.0.50.1:41234"
echo ""
echo " Default login: admin / admin123"
echo ""
echo " Next step:  sudo reboot"
echo " View logs:  journalctl -u firepulse -f"
echo ""
