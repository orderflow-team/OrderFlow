import { registerPlugin, Capacitor } from '@capacitor/core';

interface WhatsAppSharePluginApi {
  share(options: { imageBase64: string; text: string }): Promise<void>;
}

const WhatsAppShare = registerPlugin<WhatsAppSharePluginApi>('WhatsAppShare');

/**
 * Opens WhatsApp directly with an image + text attached (native Android
 * plugin — see android/app/src/main/java/com/obix/app/WhatsAppSharePlugin.java),
 * skipping Android's generic share-sheet app picker. WhatsApp still requires
 * the user to pick the contact themselves; there's no public API to
 * pre-select a chat when media is attached. Returns false (never throws) so
 * callers can fall back to the Web Share API — e.g. on non-Android platforms
 * or if WhatsApp isn't installed.
 */
export async function shareToWhatsApp(imageBase64: string, text: string): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    await WhatsAppShare.share({ imageBase64, text });
    return true;
  } catch {
    return false;
  }
}
