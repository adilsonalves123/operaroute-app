import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useState } from "react";

const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL?.trim() || "http://192.168.0.52:3000";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {error ? (
          <View style={styles.center}>
            <Text style={styles.title}>Não foi possível conectar</Text>
            <Text style={styles.text}>
              Verifique se o PC está com `npm run dev` rodando e se o celular está na mesma
              Wi‑Fi.
            </Text>
            <Text style={styles.url}>URL: {WEB_URL}</Text>
            <Text style={styles.hint}>
              Ajuste o IP em mobile/.env → EXPO_PUBLIC_WEB_URL
            </Text>
          </View>
        ) : (
          <>
            {loading && (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#00d4ff" />
                <Text style={styles.loadingText}>Carregando OperaRoute...</Text>
              </View>
            )}
            <WebView
              source={{ uri: WEB_URL }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
              onHttpError={() => {
                setLoading(false);
                setError(true);
              }}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled={Platform.OS === "android"}
              setSupportMultipleWindows={false}
            />
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0e1a",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0a0e1a",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0e1a",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    color: "#94a3b8",
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  text: {
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },
  url: {
    color: "#00d4ff",
    marginTop: 16,
    fontSize: 13,
  },
  hint: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
});
