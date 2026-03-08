#!/bin/bash
set -euo pipefail

# ============================================================
# FirePulse Appliance Setup Script
# Run from within the firepulse-appliance/ directory on the Pi.
# Usage: cd firepulse-appliance/deploy && sudo bash setup-appliance.sh
# ============================================================

APP_DIR="/opt/firepulse"
DATA_DIR="/opt/firepulse/data"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
HOTSPOT_INTERFACE="wlan0"

echo "========================================"
echo " FirePulse Appliance Setup"
echo "========================================"
echo " Source: $BASE_DIR"

# Must be root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run this script with sudo"
  exit 1
fi

# Verify we have the built app
if [ ! -d "$BASE_DIR/packages/backend/dist" ]; then
  echo "ERROR: packages/backend/dist not found."
  echo "Run 'npm run build' and 'node scripts/build-appliance.cjs' on your dev machine first."
  exit 1
fi

# ── Step 1: System packages ──────────────────────────────────
echo ""
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
  curl hostapd dnsmasq avahi-daemon \
  build-essential python3 > /dev/null

# ── Step 2: Install Node.js 20 LTS ──────────────────────────
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
fi
echo "  Node.js $(node -v), npm $(npm -v)"

# ── Step 3: Create firepulse user ────────────────────────────
echo "[3/8] Creating firepulse user..."
if ! id -u firepulse &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" firepulse
fi

# ── Step 4: Deploy application ───────────────────────────────
echo "[4/8] Deploying FirePulse to $APP_DIR..."
mkdir -p "$APP_DIR" "$DATA_DIR"

# Copy the built app (everything except deploy/ and data/)
echo "  Copying application files..."
rsync -a --delete \
  --exclude='deploy/' \
  --exclude='data/' \
  "$BASE_DIR/" "$APP_DIR/"

# Install production dependencies fresh on the Pi
echo "  Installing production dependencies (this may take a few minutes)..."
cd "$APP_DIR"
npm install --omit=dev 2>&1 | tail -1

# Generate Prisma client for this platform (linux-arm64)
echo "  Generating Prisma client for $(uname -m)..."
cd "$APP_DIR/packages/backend"
npx prisma generate

# Copy template database if no DB exists yet
if [ ! -f "$DATA_DIR/firepulse.db" ]; then
  if [ -f "$BASE_DIR/data/template.db" ]; then
    echo "  Copying template database..."
    cp "$BASE_DIR/data/template.db" "$DATA_DIR/firepulse.db"
  elif [ -f "$APP_DIR/data/template.db" ]; then
    cp "$APP_DIR/data/template.db" "$DATA_DIR/firepulse.db"
  else
    echo "  WARNING: No template.db found. The app will start with an empty database."
  fi
fi

chown -R firepulse:firepulse "$APP_DIR"

# ── Step 5: Install systemd service ──────────────────────────
echo "[5/8] Installing systemd service..."
cp "$DEPLOY_DIR/firepulse.service" /etc/systemd/system/firepulse.service
systemctl daemon-reload
systemctl enable firepulse

# ── Step 6: Configure Wi-Fi hotspot ──────────────────────────
echo "[6/8] Configuring Wi-Fi hotspot..."

# Detect Alfa USB adapter — use it if present, otherwise onboard
if iw dev | grep -q wlan1; then
  HOTSPOT_INTERFACE="wlan1"
  echo "  Detected USB Wi-Fi adapter, using wlan1"
else
  echo "  Using onboard Wi-Fi (wlan0)"
fi

# Stop wpa_supplicant on the hotspot interface (it conflicts with hostapd)
systemctl stop wpa_supplicant 2>/dev/null || true
systemctl disable wpa_supplicant 2>/dev/null || true

# Configure static IP on the hotspot interface.
# Raspberry Pi OS uses dhcpcd or NetworkManager depending on version.
if [ -f /etc/dhcpcd.conf ]; then
  # dhcpcd-based (older Pi OS)
  if ! grep -q "interface ${HOTSPOT_INTERFACE}" /etc/dhcpcd.conf; then
    cat >> /etc/dhcpcd.conf <<EOF

# FirePulse hotspot — static IP
interface ${HOTSPOT_INTERFACE}
  static ip_address=10.0.50.1/24
  nohook wpa_supplicant
EOF
  fi
elif command -v nmcli &> /dev/null; then
  # NetworkManager-based (newer Pi OS Bookworm+)
  nmcli con delete firepulse-hotspot 2>/dev/null || true
  nmcli con add type wifi ifname ${HOTSPOT_INTERFACE} con-name firepulse-hotspot \
    autoconnect yes ssid FirePulse \
    ipv4.addresses 10.0.50.1/24 ipv4.method manual
  # We still use hostapd, so just set the static IP here
  nmcli con modify firepulse-hotspot wifi.mode ap wifi-sec.key-mgmt wpa-psk wifi-sec.psk "firepulse123"
fi

# Install hostapd config
sed "s/interface=wlan0/interface=${HOTSPOT_INTERFACE}/" \
  "$DEPLOY_DIR/hostapd.conf" > /etc/hostapd/hostapd.conf

# Point hostapd to our config
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd

# Install dnsmasq config
sed "s/interface=wlan0/interface=${HOTSPOT_INTERFACE}/" \
  "$DEPLOY_DIR/dnsmasq.conf" > /etc/dnsmasq.d/firepulse.conf

# Unmask and enable hostapd
systemctl unmask hostapd
systemctl enable hostapd
systemctl enable dnsmasq

# ── Step 7: Configure mDNS ───────────────────────────────────
echo "[7/8] Configuring mDNS (firepulse.local)..."
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

# Set hostname
hostnamectl set-hostname firepulse
systemctl enable avahi-daemon

# ── Step 8: Firewall (allow app ports) ───────────────────────
echo "[8/8] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 3001/tcp comment "FirePulse HTTP" 2>/dev/null
  ufw allow 41234/udp comment "FirePulse Telemetry" 2>/dev/null
  ufw allow 67/udp comment "DHCP" 2>/dev/null
  ufw allow 53 comment "DNS" 2>/dev/null
  ufw --force enable 2>/dev/null
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "========================================"
echo " FirePulse Appliance Setup Complete!"
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
echo " Next step:  sudo reboot"
echo " View logs:  journalctl -u firepulse -f"
echo ""
