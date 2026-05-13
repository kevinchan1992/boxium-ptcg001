import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "asia.boxium.ptcg",
  appName: "BOXIUM TCG",
  // webDir points to Vite's build output (dist/public)
  webDir: "dist/public",
  // Server config: in development, point to live server for hot reload
  // In production build, remove the `server` block so the app uses local files
  server: {
    // Uncomment for live reload during development:
    // url: "https://boxium.asia",
    // cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
    hostname: "boxium.asia",
    // Allow navigation back to the web app
    allowNavigation: ["boxium.asia", "*.boxium.asia"],
  },
  ios: {
    // Minimum iOS version supported
    deploymentTarget: "16.0",
    // Use WKWebView (default in Capacitor 6+)
    contentInset: "automatic",
    // Scroll view bounces - disable for more native feel
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    // Minimum Android API level
    minSdkVersion: 26,
    targetSdkVersion: 35,
    // Allow mixed content (needed for some CDN assets)
    allowMixedContent: false,
    // Capture input
    captureInput: true,
  },
  plugins: {
    // Push Notifications configuration
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Status Bar configuration - transparent overlay for full-screen effect
    StatusBar: {
      style: "Dark",
      backgroundColor: "#000000",
      overlaysWebView: false,
    },
    // Keyboard configuration
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
    // Local Notifications (for scheduled price alerts)
    LocalNotifications: {
      smallIcon: "ic_stat_notify", // Custom notification icon in assets/android/
      iconColor: "#FEDD00", // BOXIUM brand yellow
    },
    // SplashScreen configuration
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#1212C8", // BOXIUM brand blue
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      iosSpinnerStyle: "small",
      spinnerColor: "#FEDD00", // BOXIUM brand yellow
    },
  },
};

export default config;
