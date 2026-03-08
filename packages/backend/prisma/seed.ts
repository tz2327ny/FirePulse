import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---- Users ----
  const adminPassword = await bcrypt.hash('admin123', 10);
  const instructorPassword = await bcrypt.hash('instructor123', 10);
  const medicalPassword = await bcrypt.hash('medical123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'System Admin',
      role: 'admin',
    },
  });

  const instructor = await prisma.user.upsert({
    where: { username: 'instructor1' },
    update: {},
    create: {
      username: 'instructor1',
      passwordHash: instructorPassword,
      displayName: 'Lead Instructor',
      role: 'instructor',
    },
  });

  const medical = await prisma.user.upsert({
    where: { username: 'medical1' },
    update: {},
    create: {
      username: 'medical1',
      passwordHash: medicalPassword,
      displayName: 'EMS Medic',
      role: 'medical',
    },
  });

  console.log(`  Created users: ${admin.username}, ${instructor.username}, ${medical.username}`);

  // ---- Settings (defaults) ----
  const defaultSettings = [
    { key: 'hr_warning_threshold', value: '160', description: 'Heart rate warning threshold (BPM)' },
    { key: 'hr_alarm_threshold', value: '180', description: 'Heart rate alarm threshold (BPM)' },
    { key: 'freshness_live_ms', value: '5000', description: 'Freshness: Live threshold (ms)' },
    { key: 'freshness_delayed_ms', value: '15000', description: 'Freshness: Delayed threshold (ms)' },
    { key: 'freshness_stale_ms', value: '30000', description: 'Freshness: Stale threshold (ms)' },
    { key: 'alert_sound_enabled', value: 'true', description: 'Enable alert sounds' },
    { key: 'alert_cooldown_ms', value: '60000', description: 'Alert cooldown period (ms)' },
    { key: 'heartbeat_timeout_ms', value: '30000', description: 'Receiver heartbeat timeout (ms)' },
    { key: 'merge_window_ms', value: '3000', description: 'Telemetry merge window (ms)' },
    { key: 'rollup_interval_ms', value: '5000', description: 'Telemetry rollup interval (ms)' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`  Created ${defaultSettings.length} default settings`);

  // ---- Participants (20 — matches simulator device count) ----
  const participants = [
    // Engine 1 — 4 crew
    { firstName: 'John', lastName: 'Smith', company: 'Engine 1' },
    { firstName: 'Mike', lastName: 'Johnson', company: 'Engine 1' },
    { firstName: 'Sarah', lastName: 'Williams', company: 'Engine 1' },
    { firstName: 'David', lastName: 'Brown', company: 'Engine 1' },
    // Ladder 2 — 4 crew
    { firstName: 'Chris', lastName: 'Davis', company: 'Ladder 2' },
    { firstName: 'Emily', lastName: 'Wilson', company: 'Ladder 2' },
    { firstName: 'James', lastName: 'Taylor', company: 'Ladder 2' },
    { firstName: 'Maria', lastName: 'Garcia', company: 'Ladder 2' },
    // Engine 3 — 4 crew
    { firstName: 'Robert', lastName: 'Martinez', company: 'Engine 3' },
    { firstName: 'Lisa', lastName: 'Anderson', company: 'Engine 3' },
    { firstName: 'Kevin', lastName: 'Thomas', company: 'Engine 3' },
    { firstName: 'Rachel', lastName: 'Jackson', company: 'Engine 3' },
    // Rescue 1 — 4 crew
    { firstName: 'Brian', lastName: 'White', company: 'Rescue 1' },
    { firstName: 'Nicole', lastName: 'Harris', company: 'Rescue 1' },
    { firstName: 'Derek', lastName: 'Clark', company: 'Rescue 1' },
    { firstName: 'Amanda', lastName: 'Lewis', company: 'Rescue 1' },
    // Engine 4 — 4 crew
    { firstName: 'Jason', lastName: 'Robinson', company: 'Engine 4' },
    { firstName: 'Megan', lastName: 'Walker', company: 'Engine 4' },
    { firstName: 'Tony', lastName: 'Hall', company: 'Engine 4' },
    { firstName: 'Laura', lastName: 'Allen', company: 'Engine 4' },
  ];

  const existingCount = await prisma.participant.count();
  if (existingCount === 0) {
    await prisma.participant.createMany({ data: participants });
    console.log(`  Created ${participants.length} participants`);
  } else {
    console.log(`  Participants already exist (${existingCount}), skipping`);
  }

  // ---- Devices (20 — MAC addresses match the simulator's makeMac() pattern) ----
  // Simulator generates: A0:9E:1A:4F:00:01 through A0:9E:1A:4F:00:14
  const devices = Array.from({ length: 20 }, (_, i) => {
    const idx = i + 1;
    const hex = idx.toString(16).padStart(4, '0').toUpperCase();
    const mac = `A0:9E:1A:4F:${hex.slice(0, 2)}:${hex.slice(2, 4)}`;
    const shortId = `${hex.slice(0, 2)}${hex.slice(2, 4)}`;
    return {
      macAddress: mac,
      shortId,
      deviceName: `Polar OH1 ${idx}`,
      deviceType: 'oh1_plus' as const,
    };
  });

  const existingDevices = await prisma.device.count();
  if (existingDevices === 0) {
    await prisma.device.createMany({ data: devices });
    console.log(`  Created ${devices.length} devices`);
  } else {
    console.log(`  Devices already exist (${existingDevices}), skipping`);
  }

  // ---- Receivers ----
  const receivers = [
    { receiverHwId: 'ESP32-001', name: 'Station Alpha', locationLabel: 'North Entrance' },
    { receiverHwId: 'ESP32-002', name: 'Station Bravo', locationLabel: 'South Entrance' },
    { receiverHwId: 'ESP32-003', name: 'Station Charlie', locationLabel: 'Training Tower' },
  ];

  const existingReceivers = await prisma.receiver.count();
  if (existingReceivers === 0) {
    await prisma.receiver.createMany({ data: receivers });
    console.log(`  Created ${receivers.length} receivers`);
  } else {
    console.log(`  Receivers already exist (${existingReceivers}), skipping`);
  }

  // ---- Sample Class Template (all 20 participants) ----
  const existingClasses = await prisma.class.count();
  if (existingClasses === 0) {
    const sampleClass = await prisma.class.create({
      data: {
        name: 'Live Burn Training',
        courseType: 'Live Fire',
        description: 'Standard live fire training evolution with interior operations',
      },
    });

    // Add all participants to class roster
    const allParticipants = await prisma.participant.findMany();
    if (allParticipants.length > 0) {
      await prisma.classParticipant.createMany({
        data: allParticipants.map((p) => ({
          classId: sampleClass.id,
          participantId: p.id,
        })),
      });
    }
    console.log(`  Created sample class with ${allParticipants.length} participants`);
  } else {
    console.log(`  Classes already exist (${existingClasses}), skipping`);
  }

  // ---- Auto-assign devices to participants (1:1 mapping) ----
  const existingAssignments = await prisma.deviceAssignment.count();
  if (existingAssignments === 0) {
    const allParticipants = await prisma.participant.findMany({ orderBy: { createdAt: 'asc' } });
    const allDevices = await prisma.device.findMany({ orderBy: { createdAt: 'asc' } });
    const count = Math.min(allParticipants.length, allDevices.length);
    for (let i = 0; i < count; i++) {
      await prisma.deviceAssignment.create({
        data: {
          deviceId: allDevices[i].id,
          participantId: allParticipants[i].id,
        },
      });
    }
    console.log(`  Auto-assigned ${count} devices to participants`);
  } else {
    console.log(`  Device assignments already exist (${existingAssignments}), skipping`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
