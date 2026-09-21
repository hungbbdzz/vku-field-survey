import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.edu.vku.fieldsurvey',
  appName: 'VKU Field Survey',
  webDir: 'dist',
  // When running in native context, use the bundled web assets
  server: {
    androidScheme: 'https',
    // For live reload during dev (remove for APK production build):
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
      style: 'DARK',
    },
    Camera: {
      // Permissions rationale shown to user on Android
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
