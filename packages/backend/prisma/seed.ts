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

  // ---- Participants ----
  const participants = [
    { firstName: 'John', lastName: 'Smith', company: 'Engine 1' },
    { firstName: 'Mike', lastName: 'Johnson', company: 'Engine 1' },
    { firstName: 'Sarah', lastName: 'Williams', company: 'Ladder 2' },
    { firstName: 'David', lastName: 'Brown', company: 'Ladder 2' },
    { firstName: 'Chris', lastName: 'Davis', company: 'Engine 3' },
    { firstName: 'Emily', lastName: 'Wilson', company: 'Engine 3' },
    { firstName: 'James', lastName: 'Taylor', company: 'Rescue 1' },
    { firstName: 'Maria', lastName: 'Garcia', company: 'Rescue 1' },
    { firstName: 'Robert', lastName: 'Martinez', company: 'Engine 4' },
    { firstName: 'Lisa', lastName: 'Anderson', company: 'Engine 4' },
  ];

  const existingCount = await prisma.participant.count();
  if (existingCount === 0) {
    await prisma.participant.createMany({ data: participants });
    console.log(`  Created ${participants.length} participants`);
  } else {
    console.log(`  Participants already exist (${existingCount}), skipping`);
  }

  // ---- Devices ----
  const devices = [
    { macAddress: 'A0:9E:1A:4F:8B:21', shortId: '8B21', deviceName: 'Polar OH1+ 8B21', deviceType: 'oh1_plus' },
    { macAddress: 'A0:9E:1A:4F:7C:32', shortId: '7C32', deviceName: 'Polar OH1+ 7C32', deviceType: 'oh1_plus' },
    { macAddress: 'A0:9E:1A:4F:6D:43', shortId: '6D43', deviceName: 'Polar OH1+ 6D43', deviceType: 'oh1_plus' },
    { macAddress: 'B0:B1:13:2A:5E:54', shortId: '5E54', deviceName: 'Polar H10 5E54', deviceType: 'chest_strap' },
    { macAddress: 'B0:B1:13:2A:4F:65', shortId: '4F65', deviceName: 'Polar H10 4F65', deviceType: 'chest_strap' },
    { macAddress: 'C0:D2:14:3B:3A:76', shortId: '3A76', deviceName: 'Generic HR 3A76', deviceType: 'generic_hr' },
    { macAddress: 'C0:D2:14:3B:2B:87', shortId: '2B87', deviceName: 'Generic HR 2B87', deviceType: 'generic_hr' },
    { macAddress: 'D0:E3:15:4C:1C:98', shortId: '1C98', deviceName: 'Polar OH1+ 1C98', deviceType: 'oh1_plus' },
    { macAddress: 'D0:E3:15:4C:0D:A9', shortId: '0DA9', deviceName: 'Polar H10 0DA9', deviceType: 'chest_strap' },
    { macAddress: 'E0:F4:16:5D:EE:BA', shortId: 'EEBA', deviceName: 'Polar OH1+ EEBA', deviceType: 'oh1_plus' },
  ];

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

  // ---- Sample Class Template ----
  const existingClasses = await prisma.class.count();
  if (existingClasses === 0) {
    const sampleClass = await prisma.class.create({
      data: {
        name: 'Live Burn Training',
        courseType: 'Live Fire',
        description: 'Standard live fire training evolution with interior operations',
      },
    });

    // Add first 6 participants to class roster
    const allParticipants = await prisma.participant.findMany({ take: 6 });
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
