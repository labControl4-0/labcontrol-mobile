// Página HTML com Leaflet + OpenStreetMap usada pela WebView no Android/iOS.
//
// Sem chave de API e sem conta Google. O Leaflet e os tiles vêm da internet:
// sem conexão, a página avisa o app ("leaflet-error") e a tela mostra o aviso.
// Os dados entram por injectJavaScript (buildUpdateScript), nunca pela URL.
import type { MapData } from "./mapPoints";

export const LEAFLET = {
  version: "1.9.4",
  js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  jsIntegrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
  css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  cssIntegrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
} as const;

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const OSM_MAX_ZOOM = 19;

/** Visão inicial (Brasil inteiro) até chegar a primeira posição. */
export const INITIAL_VIEW = { latitude: -14.235, longitude: -51.925, zoom: 4 } as const;

/**
 * JSON seguro para colar dentro de código JavaScript: escapa <, >, & e os
 * separadores de linha U+2028/U+2029, que quebram strings em motores antigos.
 */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp("\\u2028", "g"), "\\u2028")
    .replace(new RegExp("\\u2029", "g"), "\\u2029");
}

/** Script injetado na WebView para redesenhar os marcadores. */
export function buildUpdateScript(data: MapData): string {
  return `window.labcontrolUpdate && window.labcontrolUpdate(${serializeForScript(data)}); true;`;
}

export function buildLeafletHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET.css}" integrity="${LEAFLET.cssIntegrity}" crossorigin="">
<style>
html,body,#map{height:100%;margin:0;padding:0;background:#E5E7EB;font-family:sans-serif}
#fallback{display:none;height:100%;align-items:center;justify-content:center;text-align:center;color:#6B7280;font-size:14px;padding:16px;box-sizing:border-box}
.lc-popup strong{display:block;margin-bottom:4px;color:#111827}
.lc-popup div{color:#4B5563;font-size:12px;line-height:1.4}
</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">Mapa indisponível. Verifique a conexão com a internet.</div>
<script src="${LEAFLET.js}" integrity="${LEAFLET.jsIntegrity}" crossorigin=""></script>
<script>
(function () {
  function send(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
  }
  if (typeof L === "undefined") {
    document.getElementById("map").style.display = "none";
    document.getElementById("fallback").style.display = "flex";
    send("leaflet-error");
    return;
  }
  var map = L.map("map").setView([${INITIAL_VIEW.latitude}, ${INITIAL_VIEW.longitude}], ${INITIAL_VIEW.zoom});
  L.tileLayer("${OSM_TILE_URL}", { maxZoom: ${OSM_MAX_ZOOM}, attribution: '${OSM_ATTRIBUTION}' }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var fitted = false;
  var lastFocusKey = null;

  function valid(p) {
    return p && isFinite(p.latitude) && isFinite(p.longitude) &&
      p.latitude >= -90 && p.latitude <= 90 && p.longitude >= -180 && p.longitude <= 180;
  }
  // Texto sempre por textContent: nomes vindos da API nunca viram HTML.
  function popup(p) {
    var box = document.createElement("div");
    box.className = "lc-popup";
    var title = document.createElement("strong");
    title.textContent = String(p.label || "");
    box.appendChild(title);
    String(p.detail || "").split("\\n").forEach(function (line) {
      if (!line) return;
      var row = document.createElement("div");
      row.textContent = line;
      box.appendChild(row);
    });
    return box;
  }

  window.labcontrolUpdate = function (data) {
    if (!data || !Array.isArray(data.points)) return;
    layer.clearLayers();
    var bounds = [];
    data.points.forEach(function (p) {
      if (!valid(p)) return;
      if (p.radiusMeters) {
        L.circle([p.latitude, p.longitude], { radius: p.radiusMeters, color: p.color, weight: 1, fillOpacity: 0.12 }).addTo(layer);
      }
      L.circleMarker([p.latitude, p.longitude], {
        radius: p.kind === "me" ? 9 : 8, color: "#FFFFFF", weight: 2, fillColor: p.color, fillOpacity: 1
      }).bindPopup(popup(p)).addTo(layer);
      bounds.push([p.latitude, p.longitude]);
    });
    var f = data.focus;
    if (f && valid(f) && f.key !== lastFocusKey) {
      lastFocusKey = f.key;
      map.setView([f.latitude, f.longitude], f.zoom || 17);
      fitted = true;
    } else if (!fitted && bounds.length) {
      if (bounds.length === 1) map.setView(bounds[0], 16);
      else map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
      fitted = true;
    }
  };
  send("ready");
})();
</script>
</body>
</html>`;
}
