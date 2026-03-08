import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as telemetryService from '../services/telemetryService.js';

const router = Router();
router.use(authMiddleware);

router.get('/current', async (_req: Request, res: Response) => {
  const data = await telemetryService.getAllCurrentTelemetry();
  res.json({ data });
});

router.get('/current/:deviceMac', async (req: Request, res: Response) => {
  const dto = await telemetryService.buildCurrentTelemetryDTO(req.params.deviceMac);
  if (!dto) {
    res.status(404).json({ status: 404, message: 'Device telemetry not found' });
    return;
  }
  res.json({ data: dto });
});

router.get('/raw', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const deviceMac = req.query.device_mac as string | undefined;

  const result = await telemetryService.getRawTelemetry({ deviceMac, page, pageSize });
  res.json(result);
});

// Participant telemetry (rollups for a session)
router.get('/participant/:participantId', async (req: Request, res: Response) => {
  const { prisma } = await import('../lib/prisma.js');
  const sessionId = req.query.sessionId as string | undefined;

  const where: Record<string, unknown> = { participantId: req.params.participantId };
  if (sessionId) where.sessionId = sessionId;

  const rollups = await prisma.sessionTelemetryRollup.findMany({
    where,
    orderBy: { capturedAt: 'asc' },
    take: 1000,
  });

  res.json({ data: rollups });
});

export default router;
