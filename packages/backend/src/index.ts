import 'dotenv/config';

import http from 'node:http';
import { config } from './config.js';
import { createApp } from './server.js';
import { logger } from './lib/logger.js';
import { setupSocketServer } from './websocket/socketServer.js';
import { startUdpServer, stopUdpServer } from './udp/udpServer.js';
import { startWriteBuffer, stopWriteBuffer, startCurrentTelemetryFlush, stopCurrentTelemetryFlush, startWsEmitThrottle, stopWsEmitThrottle, startPacketRateCalc, stopPacketRateCalc } from './services/telemetryService.js';
import { startStaleSweeper, stopStaleSweeper } from './jobs/staleSweeper.js';
import { startRawTelemetryPruner, stopRawTelemetryPruner } from './jobs/rawTelemetryPruner.js';
import { startRollupGenerator, stopRollupGenerator } from './jobs/rollupGenerator.js';
import { initSqlitePragmas } from './lib/prisma.js';

let httpServer: http.Server | null = null;

export async function startBackend(): Promise<void> {
  // Optimize SQLite for high-throughput writes
  await initSqlitePragmas();

  const app = createApp();
  httpServer = http.createServer(app);

  // WebSocket
  setupSocketServer(httpServer);

  // UDP
  startUdpServer();

  // Background jobs
  startWriteBuffer();
  startCurrentTelemetryFlush();
  startWsEmitThrottle();
  startPacketRateCalc();
  startStaleSweeper();
  startRawTelemetryPruner();
  startRollupGenerator();

  // Start HTTP server
  return new Promise((resolve) => {
    httpServer!.listen(config.httpPort, '0.0.0.0', () => {
      logger.info({
        httpPort: config.httpPort,
        udpPort: config.udpPort,
        env: config.nodeEnv,
      }, 'FirePulse server started');
      resolve();
    });
  });
}

export async function stopBackend(): Promise<void> {
  logger.info('Shutting down...');
  stopUdpServer();
  stopWriteBuffer();
  stopCurrentTelemetryFlush();
  stopWsEmitThrottle();
  stopPacketRateCalc();
  stopStaleSweeper();
  stopRawTelemetryPruner();
  stopRollupGenerator();
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

// Only auto-start if run directly (not imported by Electron)
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('index.js') ||
                    process.argv[1]?.replace(/\\/g, '/').endsWith('index.ts');

if (isDirectRun) {
  startBackend().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await stopBackend();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await stopBackend();
    process.exit(0);
  });
}
