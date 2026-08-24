import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.obix.app',
  appName: 'OBIX',
  webDir: 'app-export',
  plugins: {
    // We check our own self-hosted /api/app-updates/latest endpoint manually
    // (see lib/ota-updater.ts) instead of the plugin's built-in auto-update,
    // which otherwise defaults to polling Capgo's own cloud service.
    CapacitorUpdater: {
      autoUpdate: 'off',
    },
    // launchAutoHide: false keeps the native splash (the X logo, see
    // android/.../drawable/splash.png) on screen past Android's default
    // "hide on first frame" — which fires the instant the WebView paints
    // anything, well before the Next.js bundle has hydrated. Without this,
    // that gap between "native splash gone" and "app actually rendered"
    // shows as a black WebView. SplashGif (components/splash-gif.tsx)
    // calls SplashScreen.hide() itself once its video overlay has mounted,
    // so the native splash hands off directly to the video with no gap.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffffff',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
