import { Haptics } from '@capacitor/haptics';

/**
 * Short confirming buzz after a successful barcode scan. No-ops on web.
 * 80ms was imperceptible on at least one real device — some vibration
 * motors have enough startup latency that very short pulses barely
 * register, so this uses a longer, more universally-felt duration.
 */
export async function vibrateScanSuccess() {
  try {
    await Haptics.vibrate({ duration: 200 });
  } catch {
    // Not available on this platform/device — silently skip.
  }
}
