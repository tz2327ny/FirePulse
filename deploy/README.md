# FirePulse Appliance Deployment

Turn a Raspberry Pi into a dedicated FirePulse appliance.

## Hardware

- Raspberry Pi 4 or 5 (4GB recommended)
- microSD card (16GB+)
- USB-C power supply
- Optional: Alfa AWUS036ACM USB Wi-Fi adapter for better range

## Step 1: Flash the OS

1. Download **Raspberry Pi OS Lite (64-bit)** from https://www.raspberrypi.com/software/
2. Flash to SD card using **Raspberry Pi Imager**
3. In the imager settings (gear icon), enable:
   - SSH (use password authentication)
   - Set username: `pi`, password: your choice
   - Set locale/timezone
   - Optionally set Wi-Fi (your home network — just for initial setup via SSH)

## Step 2: Build the Appliance Package (on your Windows dev machine)

```bash
cd C:\Users\tomze\FirePulse
npm run build
npm run build:appliance
```

This creates a clean, minimal `deploy/firepulse-appliance/` folder (~15 MB) containing only what the Pi needs. No Electron, no dev dependencies, no source code.

## Step 3: Copy to USB Drive

Copy `deploy\firepulse-appliance\` to a USB drive.

## Step 4: Setup on the Pi

1. Boot the Pi, SSH in
2. Mount USB and copy:
   ```bash
   sudo mount /dev/sda1 /mnt
   cp -r /mnt/firepulse-appliance ~/firepulse-appliance
   sudo umount /mnt
   ```
3. Run the setup:
   ```bash
   cd ~/firepulse-appliance/deploy
   sudo bash setup-appliance.sh
   sudo reboot
   ```

## After Reboot

- Connect to Wi-Fi: **FirePulse** (password: `firepulse123`)
- Open **http://10.0.50.1:3001** or **http://firepulse.local:3001**
- Default login: `admin` / `admin123`

## ESP32 Configuration

Point your ESP32 receivers at:
- **Wi-Fi SSID**: FirePulse
- **Wi-Fi Password**: firepulse123
- **UDP Target**: 10.0.50.1
- **UDP Port**: 41234

## Managing the Appliance

```bash
# View live logs
journalctl -u firepulse -f

# Restart / stop / status
sudo systemctl restart firepulse
sudo systemctl stop firepulse
sudo systemctl status firepulse

# Check hotspot
sudo systemctl status hostapd
```

## Updating FirePulse

On your dev machine:
```bash
npm run build
npm run build:appliance
```

Copy `deploy/firepulse-appliance/` to USB, then on the Pi:
```bash
cd ~/firepulse-appliance/deploy
sudo bash setup-appliance.sh
sudo reboot
```

## Changing the Hotspot Password

```bash
sudo nano /etc/hostapd/hostapd.conf
# Change wpa_passphrase=...
sudo systemctl restart hostapd
```
