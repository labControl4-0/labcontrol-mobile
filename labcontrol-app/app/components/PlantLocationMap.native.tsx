import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import type { PlantLocationMarker } from "../../types/plantLocation";

type Props = { markers: PlantLocationMarker[] };

function buildMapHtml(markers: PlantLocationMarker[]) {
  const safeMarkers = JSON.stringify(markers)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;margin:0}body{font-family:system-ui,-apple-system,sans-serif}</style>
</head>
<body>
  <div id="map" aria-label="Mapa geográfico das plantas"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const markers = ${safeMarkers};
    const defaultCenter = [-14.235, -51.9253];
    const map = L.map('map', { zoomControl: true }).setView(defaultCenter, 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const bounds = [];
    markers.forEach((item) => {
      const color = item.state === 'preview' ? '#2563eb' : item.state === 'pending' ? '#d97706' : '#dc2626';
      const marker = L.circleMarker([item.latitude, item.longitude], {
        radius: 9, color, fillColor: color, fillOpacity: 0.9, weight: 2
      }).addTo(map);
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.name;
      const status = document.createElement('div');
      status.textContent = item.state === 'preview' ? 'Captura atual (ainda não salva)' : item.state === 'pending' ? 'Aguardando sincronização' : 'Localização salva';
      popup.append(title, status);
      marker.bindPopup(popup);
      bounds.push([item.latitude, item.longitude]);
    });

    if (bounds.length === 1) map.setView(bounds[0], 15);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  </script>
</body>
</html>`;
}

export default function PlantLocationMap({ markers }: Props) {
  const html = useMemo(() => buildMapHtml(markers), [markers]);

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webView}
        accessibilityLabel="Mapa OpenStreetMap das plantas"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 300, borderRadius: 16, overflow: "hidden", backgroundColor: "#E5E7EB" },
  webView: { flex: 1, backgroundColor: "transparent" },
});
