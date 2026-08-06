import { Haptics } from '@capacitor/haptics';

/** Short confirming buzz after a successful barcode scan. No-ops on web. */
export async function vibrateScanSuccess() {
  try {
    await Haptics.vibrate({ duration: 80 });
  } catch {
    // Not available on this platform/device — silently skip.
  }
}
