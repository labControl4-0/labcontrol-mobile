// Mapa no Android/iOS: Leaflet + OpenStreetMap dentro de uma WebView.
// Na web o Metro usa LocationMap.web.tsx (Leaflet direto no navegador).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { WebView as RNWebView, type WebViewMessageEvent } from "react-native-webview";
import type { WebViewProps } from "react-native-webview/lib/WebView";

import { buildLeafletHtml, buildUpdateScript } from "../../lib/geo/leafletHtml";
import type { MapData } from "../../lib/geo/mapPoints";

export type LocationMapProps = MapData & { height?: number };

type WebViewHandle = { injectJavaScript: (script: string) => void };

// react-native-webview 14.0.1 declara `WebView<P = undefined>` com props
// `WebViewProps & P`, que o TypeScript 6 reduz a `never`. Aqui só o tipo é
// corrigido; o componente em tempo de execução é o mesmo.
const WebView = RNWebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewHandle> }
>;

export default function LocationMap({ points, focus, height = 300 }: LocationMapProps) {
  const webView = useRef<WebViewHandle>(null);
  const html = useMemo(buildLeafletHtml, []);
  const ready = useRef(false);
  const latest = useRef<MapData>({ points, focus });
  const [failed, setFailed] = useState(false);

  // Dados novos: redesenha. Antes do "ready" a página ainda não tem o Leaflet;
  // o último estado é enviado assim que ela avisar que carregou.
  useEffect(() => {
    latest.current = { points, focus };
    if (ready.current) webView.current?.injectJavaScript(buildUpdateScript(latest.current));
  }, [points, focus]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = event.nativeEvent.data;
    if (message === "ready") {
      ready.current = true;
      setFailed(false);
      webView.current?.injectJavaScript(buildUpdateScript(latest.current));
    } else if (message === "leaflet-error") {
      setFailed(true);
    }
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webView}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onError={() => setFailed(true)}
        // Links do mapa (atribuição do OpenStreetMap) abrem no navegador, fora do app.
        onShouldStartLoadWithRequest={(request) => {
          if (/^https?:/i.test(request.url)) {
            Linking.openURL(request.url).catch(() => undefined);
            return false;
          }
          return true;
        }}
        accessibilityLabel="Mapa com sua posição e as máquinas"
      />
      {failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>
            Mapa indisponível sem internet. As coordenadas e distâncias continuam na lista abaixo.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#E5E7EB",
  },
  overlayText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});
