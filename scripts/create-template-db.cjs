/**
 * Creates a fresh template SQLite database with schema + seed data.
 * Run as part of the build pipeline: node scripts/create-template-db.cjs
 *
 * Output: resources/template.db
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const BACKEND_DIR = path.join(ROOT, 'packages', 'backend');
const RESOURCES_DIR = path.join(ROOT, 'resources');
const TEMPLATE_DB = path.join(RESOURCES_DIR, 'template.db');
const TEMP_DIR = path.join(ROOT, '.template-db-tmp');
const TEMP_DB = path.join(TEMP_DIR, 'template.db');

// Clean up any previous temp dir
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(RESOURCES_DIR, { recursive: true });

const dbUrl = `file:${TEMP_DB}`;
const env = { ...process.env, DATABASE_URL: dbUrl };

console.log('Creating template database...');
console.log(`  DB URL: ${dbUrl}`);

// Step 1: Push schema to create tables (no migration history needed)
console.log('  Step 1/2: Pushing schema...');
execSync('npx prisma db push --skip-generate --accept-data-loss', {
  cwd: BACKEND_DIR,
  env,
  stdio: 'inherit',
});

// Step 2: Seed with default data (admin user, default settings, etc.)
console.log('  Step 2/2: Seeding data...');
try {
  execSync('npx tsx prisma/seed.ts', {
    cwd: BACKEND_DIR,
    env,
    stdio: 'inherit',
  });
} catch (err) {
  console.warn('  WARNING: Seed failed (may be OK if seed expects existing data):', err.message);
}

// Copy to resources/
if (fs.existsSync(TEMPLATE_DB)) {
  fs.unlinkSync(TEMPLATE_DB);
}
fs.copyFileSync(TEMP_DB, TEMPLATE_DB);

// Cleanup temp
fs.rmSync(TEMP_DIR, { recursive: true });

const size = (fs.statSync(TEMPLATE_DB).size / 1024).toFixed(1);
console.log(`\nTemplate database created: ${TEMPLATE_DB} (${size} KB)`);
