import { soundEngine } from './audio';

/**
 * MythOS Stored Audio Response Registry
 * Maps standard tactical responses to pre-recorded audio assets.
 */

export const STANDARD_RESPONSES: Record<string, string> = {
  'VOXCON Active. Standing by.': 'voxcon_active_standby',
  'Order received. Uplink standing by.': 'order_received_standby',
  'System recalibration complete.': 'recalibration_complete',
  'Anomaly surge detected. Engaging failsafe.': 'anomaly_detected',
  'Mic live. 16kHz uplink established.': 'mic_live',
  'NEGATIVE.': 'negative',
  'Acoustic routing audit complete. Dual-pipeline failsafe verified. Standing by.': 'routing_audit_complete',
  'Acoustic routing audit complete. Route confirmed via Windows SAPI engine. Standing by.': 'routing_audit_sapi',
};

export async function playStoredAudio(key: string): Promise<boolean> {
  // Try direct lookup by ID first (e.g. 'voxcon_active_standby')
  let audioId: string | undefined = key;
  
  // If not a direct ID, try reverse lookup by text
  const isDirectId = Object.values(STANDARD_RESPONSES).includes(key);
  if (!isDirectId) {
    audioId = STANDARD_RESPONSES[key];
  }

  if (!audioId) return false;

  return new Promise((resolve) => {
    try {
      const audio = new Audio(`/audio/${audioId}.mp3`);
      audio.onended = () => resolve(true);
      audio.onerror = () => {
        // Failsafe: Play synthesized tactical tone if asset is missing
        if (audioId === 'negative') {
          soundEngine.playNegative();
          resolve(true);
        } else if (audioId === 'order_received_standby' || audioId === 'mic_live' || audioId === 'voxcon_active_standby') {
          soundEngine.playRoger();
          resolve(true);
        } else {
          resolve(false);
        }
      };
      
      // Attempt playback
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {}).catch(() => resolve(false));
      }
    } catch {
      resolve(false);
    }
  });
}
