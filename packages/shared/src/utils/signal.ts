import {
  RSSI_EXCELLENT,
  RSSI_GOOD,
  PACKET_RATE_GOOD,
  RECEIVER_DIVERSITY_GOOD,
} from '../constants/signal.js';

export function computeSignalBars(
  rssi: number,
  packetRate: number,
  receiverCount: number
): number {
  // RSSI component: 0-2 points
  const rssiScore = rssi > RSSI_EXCELLENT ? 2 : rssi > RSSI_GOOD ? 1 : 0;

  // Packet rate component: 0-1 point
  const rateScore = packetRate >= PACKET_RATE_GOOD ? 1 : 0;

  // Receiver diversity component: 0-1 point
  const diversityScore = receiverCount >= RECEIVER_DIVERSITY_GOOD ? 1 : 0;

  return rssiScore + rateScore + diversityScore; // 0-4 bars
}
