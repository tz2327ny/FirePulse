/**
 * UDP Telemetry Simulator
 *
 * Simulates ESP32 receivers sending heart rate telemetry and heartbeat packets.
 * Usage: npx tsx tools/simulator/simulate.ts [options]
 *
 * Options:
 *   --host <ip>        Target host (default: 127.0.0.1)
 *   --port <port>      Target UDP port (default: 41234)
 *   --devices <n>      Number of simulated devices (default: 20)
 *   --receivers <n>    Number of simulated receivers (default: 4)
 *   --interval <ms>    Telemetry interval per device (default: 1000)
 *   --ramp <seconds>   Stagger device startup over N seconds (default: 0 = all at once)
 */

import dgram from 'node:dgram';

const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const HOST = getArg('host', '127.0.0.1');
const PORT = parseInt(getArg('port', '41234'));
const NUM_DEVICES = parseInt(getArg('devices', '20'));
const NUM_RECEIVERS = parseInt(getArg('receivers', '4'));
const INTERVAL_MS = parseInt(getArg('interval', '1000'));
const RAMP_SECONDS = parseInt(getArg('ramp', '0'));

const client = dgram.createSocket('udp4');

// Generate fake MAC addresses
function makeMac(index: number): string {
  const hex = index.toString(16).padStart(4, '0').toUpperCase();
  return `A0:9E:1A:4F:${hex.slice(0, 2)}:${hex.slice(2, 4)}`;
}

// HR behavior profiles for realistic firefighter training scenarios
type HRProfile = 'resting' | 'moderate' | 'working' | 'high_exertion' | 'recovery' | 'erratic';

const HR_PROFILES: Record<HRProfile, { baseRange: [number, number]; variability: number; spikeChance: number; spikeAmount: number }> = {
  resting:        { baseRange: [62, 78],   variability: 4,  spikeChance: 0.01, spikeAmount: 10 },
  moderate:       { baseRange: [85, 110],  variability: 8,  spikeChance: 0.03, spikeAmount: 15 },
  working:        { baseRange: [110, 140], variability: 12, spikeChance: 0.05, spikeAmount: 20 },
  high_exertion:  { baseRange: [140, 175], variability: 15, spikeChance: 0.08, spikeAmount: 25 },
  recovery:       { baseRange: [100, 130], variability: 10, spikeChance: 0.02, spikeAmount: 12 },
  erratic:        { baseRange: [90, 150],  variability: 25, spikeChance: 0.15, spikeAmount: 35 },
};

// Assign profiles to create a realistic class mix
function assignProfile(index: number): HRProfile {
  const profiles: HRProfile[] = [
    'resting', 'resting',                                // 2 — standing by / medical staff
    'moderate', 'moderate', 'moderate', 'moderate',       // 4 — staging / light activity
    'working', 'working', 'working', 'working', 'working', 'working',  // 6 — on-air / actively working
    'high_exertion', 'high_exertion', 'high_exertion',   // 3 — heavy exertion / search & rescue
    'recovery', 'recovery', 'recovery',                  // 3 — post-exertion cooldown
    'erratic', 'erratic',                                 // 2 — sensor irregularities / stress response
  ];
  return profiles[index % profiles.length];
}

// Simulate heart rate with profile-based variability
function simulateHR(device: SimDevice, elapsed: number): number {
  const profile = HR_PROFILES[device.profile];

  // Slow drift (sinusoidal baseline shift)
  const drift = Math.sin(elapsed / (8000 + device.driftOffset)) * (profile.variability * 0.6);

  // Medium-frequency variation (breathing / exertion cycles)
  const breathCycle = Math.sin(elapsed / (3000 + device.breathOffset)) * (profile.variability * 0.3);

  // Random noise
  const noise = (Math.random() - 0.5) * profile.variability;

  // Occasional spikes (adrenaline dumps, sensor glitches)
  let spike = 0;
  if (Math.random() < profile.spikeChance) {
    spike = (Math.random() > 0.5 ? 1 : -1) * profile.spikeAmount * Math.random();
  }

  // Gradual trend over time (fatigue = slowly rising HR)
  const fatigueTrend = device.profile === 'working' || device.profile === 'high_exertion'
    ? Math.min(15, elapsed / 60000 * 2)  // +2 bpm per minute, max +15
    : 0;

  const hr = device.baseHR + drift + breathCycle + noise + spike + fatigueTrend;
  return Math.round(Math.max(45, Math.min(210, hr)));
}

// Simulate RSSI with some per-device consistency
function simulateRSSI(deviceIndex: number): number {
  const base = -55 - (deviceIndex % 5) * 8; // -55 to -87 base by device
  const jitter = (Math.random() - 0.5) * 10;
  return Math.round(Math.max(-95, Math.min(-40, base + jitter)));
}

interface SimDevice {
  mac: string;
  name: string;
  baseHR: number;
  profile: HRProfile;
  driftOffset: number;
  breathOffset: number;
  startDelay: number; // ms after sim start before this device comes online
}

interface SimReceiver {
  id: string;
  name: string;
}

// Create simulated devices with assigned profiles and staggered start delays
const rampMs = RAMP_SECONDS * 1000;
const devices: SimDevice[] = [];
for (let i = 0; i < NUM_DEVICES; i++) {
  const profile = assignProfile(i);
  const [lo, hi] = HR_PROFILES[profile].baseRange;

  // Spread devices evenly across the ramp window with a small random jitter
  const evenSpread = rampMs > 0 ? (i / NUM_DEVICES) * rampMs : 0;
  const jitter = rampMs > 0 ? (Math.random() - 0.5) * (rampMs / NUM_DEVICES) : 0;
  const startDelay = Math.max(0, Math.round(evenSpread + jitter));

  devices.push({
    mac: makeMac(i + 1),
    name: `Polar OH1 ${i + 1}`,
    baseHR: lo + Math.random() * (hi - lo),
    profile,
    driftOffset: Math.random() * 5000,
    breathOffset: Math.random() * 2000,
    startDelay,
  });
}

// Sort by start delay so log output shows arrival order
devices.sort((a, b) => a.startDelay - b.startDelay);

// Create simulated receivers
const receivers: SimReceiver[] = [];
for (let i = 0; i < NUM_RECEIVERS; i++) {
  receivers.push({
    id: `ESP32-SIM-${String(i + 1).padStart(3, '0')}`,
    name: `Simulator ${i + 1}`,
  });
}

const startTime = Date.now();
let packetCount = 0;

function sendTelemetry() {
  const elapsed = Date.now() - startTime;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];

    // Skip devices that haven't come online yet (staggered ramp)
    if (elapsed < device.startDelay) continue;

    // Each device seen by 1-3 random receivers
    const numReceivers = 1 + Math.floor(Math.random() * Math.min(NUM_RECEIVERS, 3));
    const selectedReceivers = [...receivers].sort(() => Math.random() - 0.5).slice(0, numReceivers);

    for (const receiver of selectedReceivers) {
      const packet = {
        type: 'telemetry',
        receiver_id: receiver.id,
        receiver_name: receiver.name,
        timestamp: new Date().toISOString(),
        device_mac: device.mac,
        device_name: device.name,
        heart_rate: simulateHR(device, elapsed),
        rssi: simulateRSSI(i),
      };

      const msg = Buffer.from(JSON.stringify(packet));
      client.send(msg, PORT, HOST);
      packetCount++;
    }
  }
}

function sendHeartbeats() {
  for (const receiver of receivers) {
    const packet = {
      type: 'heartbeat',
      receiver_id: receiver.id,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      ip_address: `192.168.1.${50 + receivers.indexOf(receiver)}`,
      wifi_rssi: -30 - Math.floor(Math.random() * 20),
      firmware_version: '1.0.0-sim',
      timestamp: new Date().toISOString(),
    };

    const msg = Buffer.from(JSON.stringify(packet));
    client.send(msg, PORT, HOST);
  }
}

// Log stats with profile breakdown
const profileCounts: Record<string, number> = {};
for (const d of devices) {
  profileCounts[d.profile] = (profileCounts[d.profile] || 0) + 1;
}

console.log(`[Simulator] Started: ${NUM_DEVICES} devices, ${NUM_RECEIVERS} receivers, ${INTERVAL_MS}ms interval`);
console.log(`[Simulator] Sending to ${HOST}:${PORT}`);
if (RAMP_SECONDS > 0) {
  console.log(`[Simulator] Ramp: devices will come online over ${RAMP_SECONDS}s`);
}
console.log(`[Simulator] HR Profiles: ${Object.entries(profileCounts).map(([k, v]) => `${k}(${v})`).join(', ')}`);
console.log('[Simulator] Press Ctrl+C to stop\n');

// Log stats periodically
setInterval(() => {
  const elapsed = Date.now() - startTime;
  const activeCount = devices.filter((d) => elapsed >= d.startDelay).length;
  const sampleHRs = devices.filter((d) => elapsed >= d.startDelay).slice(0, 5)
    .map((d) => `${d.name.split(' ').pop()}:${simulateHR(d, elapsed)}`).join(' ');
  const rampStatus = activeCount < NUM_DEVICES ? ` (${activeCount}/${NUM_DEVICES} online)` : '';
  console.log(`[Simulator] ${packetCount} packets${rampStatus} | Sample HRs: ${sampleHRs}`);
}, 5000);

// Send telemetry at interval
setInterval(sendTelemetry, INTERVAL_MS);

// Send heartbeats every 10 seconds
setInterval(sendHeartbeats, 10000);

// Send initial data immediately
sendHeartbeats();
sendTelemetry();
