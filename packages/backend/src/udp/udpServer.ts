import dgram from 'node:dgram';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { parsePacketType, parseTelemetryPacket, parseHeartbeatPacket } from './packetParser.js';
import { handleTelemetryPacket } from './handlers/telemetryHandler.js';
import { handleHeartbeatPacket } from './handlers/heartbeatHandler.js';

let server: dgram.Socket | null = null;

export function startUdpServer() {
  server = dgram.createSocket('udp4');

  server.on('message', (msg, rinfo) => {
    try {
      const raw = msg.toString('utf8');
      let data: unknown;

      try {
        data = JSON.parse(raw);
      } catch {
        logger.warn({ src: `${rinfo.address}:${rinfo.port}`, raw: raw.slice(0, 200) }, 'Malformed UDP packet (not JSON)');
        return;
      }

      const type = parsePacketType(data);
      if (!type) {
        logger.warn({ src: `${rinfo.address}:${rinfo.port}` }, 'UDP packet missing or invalid type field');
        return;
      }

      if (type === 'telemetry') {
        const packet = parseTelemetryPacket(data);
        if (packet) {
          handleTelemetryPacket(packet);
        } else {
          logger.warn({ src: `${rinfo.address}:${rinfo.port}` }, 'Invalid telemetry packet schema');
        }
      } else if (type === 'heartbeat') {
        const packet = parseHeartbeatPacket(data);
        if (packet) {
          handleHeartbeatPacket(packet);
        } else {
          logger.warn({ src: `${rinfo.address}:${rinfo.port}` }, 'Invalid heartbeat packet schema');
        }
      }
    } catch (err) {
      logger.error({ err, src: `${rinfo.address}:${rinfo.port}` }, 'Unexpected error processing UDP packet');
    }
  });

  server.on('error', (err) => {
    logger.error({ err }, 'UDP server error');
    server?.close();
  });

  server.bind(config.udpPort, '0.0.0.0', () => {
    logger.info({ port: config.udpPort }, 'UDP server listening');
  });

  return server;
}

export function stopUdpServer() {
  if (server) {
    server.close();
    server = null;
  }
}
