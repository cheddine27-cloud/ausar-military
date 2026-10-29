import { Session } from './types';

export interface DynamicQRData {
  sessionId: string;
  timestamp: number;
  code: string;
}

export function generateDynamicQR(session: Session): DynamicQRData {
  const timestamp = Date.now();
  return {
    sessionId: session.id,
    timestamp,
    code: session.code
  };
}

export function isQRValid(qrData: DynamicQRData, maxAgeSeconds: number = 120): boolean {
  const now = Date.now();
  const age = (now - qrData.timestamp) / 1000;
  return age <= maxAgeSeconds;
}

export function encodeQRData(data: DynamicQRData): string {
  return JSON.stringify(data);
}

export function decodeQRData(encoded: string): DynamicQRData | null {
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}
