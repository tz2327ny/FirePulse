import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;
let logStream: fs.WriteStream | null = null;

const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// ── Logging ──────────────────────────────────────────────────────
function getAppDataDir(): string {
  return path.join(app.getPath('appData'), 'FirePulse');
}

function ensureAppDataDir(): void {
  const dir = getAppDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initLogging(): void {
  ensureAppDataDir();
  const logPath = path.join(getAppDataDir(), 'firepulse.log');
  // Rotate: keep last log as .log.old
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) {
      fs.renameSync(logPath, logPath + '.old');
    }
  } catch { /* ignore */ }
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  log('='.repeat(60));
  log(`FirePulse starting — ${new Date().toISOString()}`);
  log(`app.isPackaged: ${app.isPackaged}`);
  log(`__dirname: ${__dirname}`);
  log(`process.execPath: ${process.execPath}`);
  log(`process.resourcesPath: ${process.resourcesPath}`);
  log(`appData: ${getAppDataDir()}`);
}

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream?.write(line + '\n');
}

function logError(msg: string, err?: unknown): void {
  const errStr = err instanceof Error ? err.stack || err.message : String(err ?? '');
  log(`ERROR: ${msg} ${errStr}`);
}

// ── Paths ────────────────────────────────────────────────────────
function getResourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', filename);
  }
  return path.join(__dirname, '..', 'resources', filename);
}

function getBackendDir(): string {
  if (app.isPackaged) {
    // With asar: false, files are in resources/app/
    return path.join(process.resourcesPath, 'app', 'packages', 'backend');
  }
  return path.join(__dirname, '..', 'packages', 'backend');
}

function getBackendEntry(): string {
  return path.join(getBackendDir(), 'dist', 'index.js');
}

function getDbPath(): string {
  const appDataDir = getAppDataDir();
  return `file:${path.join(appDataDir, 'firepulse.db')}`;
}

// ── Database ─────────────────────────────────────────────────────
function ensureDatabase(): void {
  const dbFile = path.join(getAppDataDir(), 'firepulse.db');

  if (fs.existsSync(dbFile)) {
    const size = (fs.statSync(dbFile).size / 1024).toFixed(1);
    log(`Database already exists: ${dbFile} (${size} KB)`);
    return;
  }

  // First launch: copy the pre-built template database
  const templatePath = getResourcePath('template.db');
  log(`First launch — copying template DB`);
  log(`  from: ${templatePath}`);
  log(`  to:   ${dbFile}`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template database not found: ${templatePath}\n` +
      'The installer may be corrupted. Please reinstall FirePulse.'
    );
  }

  fs.copyFileSync(templatePath, dbFile);
  const size = (fs.statSync(dbFile).size / 1024).toFixed(1);
  log(`Database created successfully (${size} KB)`);
}

// ── Backend ──────────────────────────────────────────────────────
async function startBackendProcess(): Promise<void> {
  return new Promise((resolve, reject) => {
    const entry = getBackendEntry();
    const dbUrl = getDbPath();

    log(`Forking backend: ${entry}`);
    log(`  exists: ${fs.existsSync(entry)}`);

    if (!fs.existsSync(entry)) {
      const err = new Error(`Backend entry not found: ${entry}`);
      logError('Cannot fork backend', err);
      reject(err);
      return;
    }

    backendProcess = fork(entry, [], {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        HTTP_PORT: String(BACKEND_PORT),
        NODE_ENV: 'production',
        JWT_SECRET: 'firepulse-local-' + app.getPath('appData').length,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    backendProcess.stdout?.on('data', (data: Buffer) => {
      log(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      log(`[backend:err] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      logError('Backend process error', err);
      reject(err);
    });

    backendProcess.on('exit', (code, signal) => {
      log(`Backend process exited — code: ${code}, signal: ${signal}`);
      backendProcess = null;
    });

    // Give the fork a moment to fail or succeed
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        log('Backend fork appears healthy');
        resolve();
      } else {
        reject(new Error('Backend process died immediately after fork'));
      }
    }, 1000);
  });
}

function stopBackend(): void {
  if (backendProcess) {
    log('Stopping backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

async function waitForBackend(maxRetries = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        log(`Backend ready after ${i + 1} health checks`);
        return;
      }
    } catch {
      // Not ready yet
    }
    if (i % 5 === 0) log(`Waiting for backend... attempt ${i + 1}/${maxRetries}`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Backend failed to start within timeout (30s)');
}

// ── Window & Tray ────────────────────────────────────────────────
function createWindow(): void {
  const iconPath = getResourcePath('icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath,
    title: 'FirePulse',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  log(`Loading URL: ${BACKEND_URL}`);
  mainWindow.loadURL(BACKEND_URL);

  mainWindow.once('ready-to-show', () => {
    log('Window ready-to-show');
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (mainWindow) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const iconPath = getResourcePath('icon.ico');
  log(`Creating tray with icon: ${iconPath} — exists: ${fs.existsSync(iconPath)}`);

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('FirePulse — Firefighter HR Monitoring');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show FirePulse',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Log File',
      click: () => {
        const logPath = path.join(getAppDataDir(), 'firepulse.log');
        shell.openPath(logPath);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit FirePulse',
      click: () => {
        if (mainWindow) {
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }
        stopBackend();
        tray?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── App Lifecycle ────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    initLogging();
    log('Starting FirePulse...');

    // Step 1: Database
    log('Step 1/4: Ensuring database');
    ensureDatabase();

    // Step 2: Backend
    log('Step 2/4: Starting backend');
    await startBackendProcess();

    // Step 3: Wait for backend
    log('Step 3/4: Waiting for backend health check');
    await waitForBackend();

    // Step 4: UI
    log('Step 4/4: Creating window and tray');
    createTray();
    createWindow();

    log('FirePulse startup complete!');
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    logError('FATAL: Failed to start FirePulse', err);

    dialog.showErrorBox(
      'FirePulse — Startup Error',
      `FirePulse failed to start.\n\n${msg}\n\nLog file: ${path.join(getAppDataDir(), 'firepulse.log')}`
    );

    stopBackend();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in the system tray
});

app.on('before-quit', () => {
  log('App quitting...');
  stopBackend();
  logStream?.end();
});
