import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { PlantLocationMarker } from "../../types/plantLocation";

type Props = { markers: PlantLocationMarker[] };

function mapUrl(marker: PlantLocationMarker) {
  return `https://www.openstreetmap.org/?mlat=${marker.latitude}&mlon=${marker.longitude}#map=15/${marker.latitude}/${marker.longitude}`;
}

export default function PlantLocationMap({ markers }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa OpenStreetMap</Text>
      <Text style={styles.description}>
        No navegador, abra cada ponto no OpenStreetMap. O mapa incorporado com Leaflet aparece no Android e iOS.
      </Text>
      {markers.length === 0 ? (
        <Text style={styles.empty}>Ainda não há coordenadas para exibir.</Text>
      ) : markers.map((marker) => (
        <TouchableOpacity
          key={marker.id}
          accessibilityRole="link"
          style={styles.link}
          onPress={() => Linking.openURL(mapUrl(marker))}
        >
          <Text style={styles.linkTitle}>{marker.name}</Text>
          <Text style={styles.linkDetail}>
            {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)} · {marker.state === "pending" ? "pendente" : marker.state === "preview" ? "captura atual" : "salva"}
          </Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 180, padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF" },
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  description: { marginTop: 6, color: "#6B7280", lineHeight: 19, fontSize: 12 },
  empty: { marginTop: 14, color: "#6B7280", fontSize: 13 },
  link: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6" },
  linkTitle: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  linkDetail: { marginTop: 4, color: "#6B7280", fontSize: 12 },
  attribution: { marginTop: 12, color: "#6B7280", fontSize: 10 },
});
