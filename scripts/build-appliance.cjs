/**
 * Build a self-contained FirePulse appliance package.
 * Output: deploy/firepulse-appliance/  (ready to copy to USB)
 *
 * Usage: node scripts/build-appliance.cjs
 * (Run after `npm run build` completes)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'deploy', 'firepulse-appliance');

// ── Helpers ──────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dst) {
  ensureDir(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

// ── Clean previous build ────────────────────────────────────
console.log('Building FirePulse appliance package...\n');

if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true });
}
ensureDir(OUT);

// ── 1. Backend dist ─────────────────────────────────────────
console.log('[1/7] Copying backend dist...');
copyDir(
  path.join(ROOT, 'packages', 'backend', 'dist'),
  path.join(OUT, 'packages', 'backend', 'dist')
);
copyFile(
  path.join(ROOT, 'packages', 'backend', 'package.json'),
  path.join(OUT, 'packages', 'backend', 'package.json')
);

// ── 2. Prisma schema + migrations ───────────────────────────
console.log('[2/7] Copying Prisma schema...');
copyDir(
  path.join(ROOT, 'packages', 'backend', 'prisma'),
  path.join(OUT, 'packages', 'backend', 'prisma')
);

// ── 3. Frontend dist ────────────────────────────────────────
console.log('[3/7] Copying frontend dist...');
copyDir(
  path.join(ROOT, 'packages', 'frontend', 'dist'),
  path.join(OUT, 'packages', 'frontend', 'dist')
);

// ── 4. Shared dist ──────────────────────────────────────────
console.log('[4/7] Copying shared dist...');
copyDir(
  path.join(ROOT, 'packages', 'shared', 'dist'),
  path.join(OUT, 'packages', 'shared', 'dist')
);
copyFile(
  path.join(ROOT, 'packages', 'shared', 'package.json'),
  path.join(OUT, 'packages', 'shared', 'package.json')
);

// ── 5. Root package files ───────────────────────────────────
console.log('[5/7] Copying package.json + lock file...');

// Create a stripped-down package.json (no electron/devDeps)
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const appliancePkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  private: true,
  workspaces: rootPkg.workspaces,
  dependencies: { ...rootPkg.dependencies },
  engines: rootPkg.engines,
};
// Remove electron-only deps
delete appliancePkg.dependencies['electron'];
delete appliancePkg.dependencies['electron-builder'];

fs.writeFileSync(
  path.join(OUT, 'package.json'),
  JSON.stringify(appliancePkg, null, 2) + '\n'
);

// Copy lock file if it exists (for `npm ci`)
const lockFile = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(lockFile)) {
  copyFile(lockFile, path.join(OUT, 'package-lock.json'));
}

// ── 6. Template database ────────────────────────────────────
console.log('[6/7] Copying template database...');
const templateDb = path.join(ROOT, 'resources', 'template.db');
if (fs.existsSync(templateDb)) {
  copyFile(templateDb, path.join(OUT, 'data', 'template.db'));
} else {
  console.warn('  WARNING: resources/template.db not found. Run `npm run build` first.');
}

// ── 7. Deploy scripts ───────────────────────────────────────
console.log('[7/7] Copying deploy scripts...');
const deployFiles = [
  'setup-appliance.sh',
  'firepulse.service',
  'hostapd.conf',
  'dnsmasq.conf',
  'README.md',
];
for (const file of deployFiles) {
  const src = path.join(ROOT, 'deploy', file);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(OUT, 'deploy', file));
  }
}

// ── Summary ─────────────────────────────────────────────────
function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

const sizeMB = (dirSize(OUT) / 1024 / 1024).toFixed(1);
console.log(`\n========================================`);
console.log(` Appliance package built: ${sizeMB} MB`);
console.log(` Output: deploy/firepulse-appliance/`);
console.log(`========================================`);
console.log(`\nCopy this folder to a USB drive, then on the Pi:`);
console.log(`  cd firepulse-appliance/deploy`);
console.log(`  sudo bash setup-appliance.sh`);
console.log(`  sudo reboot`);
