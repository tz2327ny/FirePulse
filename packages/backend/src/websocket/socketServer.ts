import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { socketAuthMiddleware } from './socketAuth.js';

let io: SocketServer | null = null;

export function setupSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    logger.info({ userId: socket.data.userId, socketId: socket.id }, 'Client connected');

    // Auto-join telemetry room
    socket.join('telemetry');

    socket.on('subscribe:telemetry', () => {
      socket.join('telemetry');
    });

    socket.on('unsubscribe:telemetry', () => {
      socket.leave('telemetry');
    });

    socket.on('subscribe:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });

    socket.on('unsubscribe:session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.data.userId, reason }, 'Client disconnected');
    });
  });

  // Listen to EventBus channels and broadcast to Socket.IO clients
  // Batched telemetry updates (every 250ms from telemetryService)
  eventBus.on('telemetry:batch', (dtos: unknown[]) => {
    io?.to('telemetry').emit('telemetry:update', dtos);
  });

  eventBus.on('receiver:heartbeat', (data) => {
    io?.to('telemetry').emit('receiver:heartbeat', data);
  });

  eventBus.on('receiver:status', (data) => {
    io?.to('telemetry').emit('receiver:status', data);
  });

  eventBus.on('alert:new', (data) => {
    io?.to('telemetry').emit('alert:new', data);
  });

  eventBus.on('alert:updated', (data) => {
    io?.to('telemetry').emit('alert:updated', data);
  });

  eventBus.on('session:updated', (data) => {
    io?.to('telemetry').emit('session:updated', data);
  });

  eventBus.on('rehab:visit_created', (data) => {
    io?.to('telemetry').emit('rehab:visit_created', data);
  });

  eventBus.on('rehab:visit_updated', (data) => {
    io?.to('telemetry').emit('rehab:visit_updated', data);
  });

  eventBus.on('rehab:visit_cancelled', (data) => {
    io?.to('telemetry').emit('rehab:visit_cancelled', data);
  });

  logger.info('Socket.IO server initialized');
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}
