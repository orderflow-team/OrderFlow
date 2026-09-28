import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.obix.app',
  appName: 'OBIX',
  webDir: 'app-export',
  // No `server.url` here: it makes the native app load that URL instead of its
  // bundled/OTA web code. versionCode 18 shipped to the Play Store with a LAN
  // dev-server URL baked in this way. For live reload use `npm run
  // android:live` (`cap run -l`), which injects the URL for that run only.
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
