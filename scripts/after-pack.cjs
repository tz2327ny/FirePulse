/**
 * electron-builder afterPack hook.
 * Copies the generated Prisma client (.prisma/client/) into the packaged app
 * AFTER npm prune runs (which removes it because it's not a real npm package).
 */
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const appNodeModules = path.join(appOutDir, 'resources', 'app', 'node_modules');
  const src = path.join(process.cwd(), 'node_modules', '.prisma');
  const dst = path.join(appNodeModules, '.prisma');

  console.log(`[afterPack] Copying generated Prisma client...`);
  console.log(`  from: ${src}`);
  console.log(`  to:   ${dst}`);

  if (!fs.existsSync(src)) {
    console.error('[afterPack] ERROR: .prisma directory not found! Run "npx prisma generate" first.');
    process.exit(1);
  }

  // Copy recursively
  fs.cpSync(src, dst, { recursive: true });

  // Verify the key file exists
  const defaultJs = path.join(dst, 'client', 'default.js');
  if (fs.existsSync(defaultJs)) {
    console.log('[afterPack] Prisma client copied successfully');
  } else {
    console.error('[afterPack] WARNING: .prisma/client/default.js not found after copy');
  }
};
