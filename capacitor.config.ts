import type { CapacitorConfig } from "@capacitor/cli";

/**
 * OperaRoute no Android carrega o app web em produção.
 * Next.js tem API routes/SSR — não dá para empacotar o site inteiro como estático.
 * Domínio válido: operaroute.com.br (operarout.com.br está sem DNS).
 */
const config: CapacitorConfig = {
  appId: "com.operaroute.app",
  appName: "OperaRoute",
  webDir: "www",
  server: {
    url: "https://operaroute.com.br",
    cleartext: false,
    androidScheme: "https",
    hostname: "operaroute.com.br",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
