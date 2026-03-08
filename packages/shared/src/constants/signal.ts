// RSSI thresholds for signal quality scoring
export const RSSI_EXCELLENT = -60;  // 2 points
export const RSSI_GOOD = -75;      // 1 point
// Below -75 = 0 points

// Packet rate threshold for signal scoring
export const PACKET_RATE_GOOD = 0.5; // packets/sec for 1 point

// Receiver diversity threshold
export const RECEIVER_DIVERSITY_GOOD = 2; // receivers for 1 point

// Maximum signal bars
export const MAX_SIGNAL_BARS = 4;
