// Mapa na Web: Leaflet direto no navegador (sem WebView).
//
// O Leaflet usa `window` assim que é importado. Como o app gera páginas
// estáticas (web.output = "static"), a importação é dinâmica, dentro do
// useEffect, para não rodar durante a renderização no servidor.
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

import { INITIAL_VIEW, OSM_ATTRIBUTION, OSM_MAX_ZOOM, OSM_TILE_URL } from "../../lib/geo/leafletHtml";
import { isValidCoordinates } from "../../lib/geo/distance";
import type { MapData, MapFocus, MapPoint } from "../../lib/geo/mapPoints";

export type LocationMapProps = MapData & { height?: number };

type MapState = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  layer: Leaflet.LayerGroup;
  fitted: boolean;
  lastFocusKey: number | null;
};

// Texto sempre por textContent: nomes vindos da API nunca viram HTML.
function popupElement(point: MapPoint): HTMLElement {
  const box = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = point.label;
  title.style.display = "block";
  title.style.marginBottom = "4px";
  box.appendChild(title);
  for (const line of point.detail.split("\n")) {
    if (!line) continue;
    const row = document.createElement("div");
    row.textContent = line;
    row.style.fontSize = "12px";
    box.appendChild(row);
  }
  return box;
}

function draw(state: MapState, points: MapPoint[], focus: MapFocus | null) {
  const { L, map, layer } = state;
  layer.clearLayers();
  const bounds: Leaflet.LatLngTuple[] = [];

  for (const p of points) {
    if (!isValidCoordinates(p)) continue;
    if (p.radiusMeters) {
      L.circle([p.latitude, p.longitude], {
        radius: p.radiusMeters,
        color: p.color,
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(layer);
    }
    L.circleMarker([p.latitude, p.longitude], {
      radius: p.kind === "me" ? 9 : 8,
      color: "#FFFFFF",
      weight: 2,
      fillColor: p.color,
      fillOpacity: 1,
    })
      .bindPopup(popupElement(p))
      .addTo(layer);
    bounds.push([p.latitude, p.longitude]);
  }

  if (focus && isValidCoordinates(focus) && focus.key !== state.lastFocusKey) {
    state.lastFocusKey = focus.key;
    map.setView([focus.latitude, focus.longitude], focus.zoom || 17);
    state.fitted = true;
  } else if (!state.fitted && bounds.length > 0) {
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
    state.fitted = true;
  }
}

export default function LocationMap({ points, focus, height = 300 }: LocationMapProps) {
  const element = useRef<HTMLDivElement | null>(null);
  const state = useRef<MapState | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("leaflet")
      .then((module) => {
        if (cancelled || !element.current) return;
        const L = ((module as { default?: typeof Leaflet }).default ?? module) as typeof Leaflet;
        const map = L.map(element.current).setView(
          [INITIAL_VIEW.latitude, INITIAL_VIEW.longitude],
          INITIAL_VIEW.zoom
        );
        L.tileLayer(OSM_TILE_URL, { maxZoom: OSM_MAX_ZOOM, attribution: OSM_ATTRIBUTION }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        state.current = { L, map, layer, fitted: false, lastFocusKey: null };
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && state.current) draw(state.current, points, focus);
  }, [ready, points, focus]);

  return (
    <View style={[styles.wrap, { height }]}>
      <div
        ref={element}
        style={{ width: "100%", height: "100%" }}
        aria-label="Mapa com sua posição e as máquinas"
      />
      {failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>Não foi possível carregar o mapa.</Text>
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
