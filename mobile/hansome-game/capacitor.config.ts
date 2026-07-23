import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Internal QA wrapper only — loads live production game URL.
 * Web updates ship without APK rebuild.
 */
const config: CapacitorConfig = {
  appId: "xyz.hansomealpacas.game",
  appName: "HANSOME",
  webDir: "www",
  server: {
    url: "https://game.hansomealpacas.xyz",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "game.hansomealpacas.xyz",
      "*.hansomealpacas.xyz",
      "hansomealpacas.xyz",
      "www.hansomealpacas.xyz",
      "metamask.app.link",
      "link.metamask.io",
      "www.okx.com",
      "okx.com",
      "robinhoodchain.blockscout.com",
      "*.blockscout.com",
      "gateway.pinata.cloud",
      "rpc.mainnet.chain.robinhood.com",
      "relay.walletconnect.com",
      "*.walletconnect.com",
      "*.walletconnect.org",
      "verify.walletconnect.com",
      "verify.walletconnect.org",
      "*.reown.com",
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0a0a0f",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
