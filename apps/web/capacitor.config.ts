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
    // Keep the static native splash until the web app has hydrated, so Android
    // does not briefly expose an unpainted WebView. DismissNativeSplash hides
    // it immediately after hydration; no animated web splash is shown.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffffff',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
