import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  Animated,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import Svg, { Polygon, Circle, G, Rect } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getAuthSession } from "../../../lib/auth";
import type { Plant, Sector, SectorPoint, Machine, MachineStatus, BBox } from "../../../types/blueprint";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE      = "http://ec2-3-222-252-59.compute-1.amazonaws.com/api";
const CANVAS_PADDING = 48;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#0d1117",
  canvas:      "#0f1923",
  white:       "#e8f4ff",
  muted:       "#4a6fa5",
  panel:       "#111827",
  panelBorder: "rgba(80,160,255,0.2)",
  sectorLabel: "#5ab4ff",
  active:      "#00e676",
  warning:     "#ffb300",
  error:       "#ff1744",
  idle:        "#546e7a",
};

const STATUS_COLOR: Record<MachineStatus, string> = {
  active:  C.active,
  warning: C.warning,
  error:   C.error,
  idle:    C.idle,
};

const STATUS_LABEL: Record<MachineStatus, string> = {
  active:  "Ativo",
  warning: "Alerta",
  error:   "Falha",
  idle:    "Inativo",
};

// ─── API ──────────────────────────────────────────────────────────────────────
async function buildHeaders(): Promise<Record<string, string>> {
  const session = await getAuthSession();
  return {
    accept:        "text/plain",
    Authorization: `Bearer ${session!.token}`,
  };
}

async function fetchPlant(id: string): Promise<Plant> {
  const res = await fetch(`${API_BASE}/plants/${id}`, { headers: await buildHeaders() });
  if (!res.ok) throw new Error(`Erro ao buscar planta (${res.status})`);
  return res.json();
}

async function fetchSectors(plantId: string): Promise<Sector[]> {
  const res = await fetch(`${API_BASE}/sectors/plant/${plantId}`, { headers: await buildHeaders() });
  if (!res.ok) throw new Error(`Erro ao buscar setores (${res.status})`);
  const raw: Omit<Sector, "points">[] = await res.json();
  return raw.map((s) => ({ ...s, points: JSON.parse(s.pointsJson) as SectorPoint[] }));
}

async function fetchMachines(plantId: string): Promise<Machine[]> {
  const res = await fetch(`${API_BASE}/machines/plant/${plantId}`, { headers: await buildHeaders() });
  if (!res.ok) throw new Error(`Erro ao buscar máquinas (${res.status})`);
  return res.json();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function computeBBox(sectors: Sector[], machines: Machine[], canvasH: number): BBox {
  const allX: number[] = [];
  const allY: number[] = [];

  for (const s of sectors) for (const p of s.points) { allX.push(p.X); allY.push(p.Y); }
  for (const m of machines)                           { allX.push(m.posX); allY.push(m.posY); }

  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const rawW = maxX - minX;
  const rawH = maxY - minY;

  const scale   = Math.min(
    (SCREEN_W - CANVAS_PADDING * 2) / rawW,
    (canvasH  - CANVAS_PADDING * 2) / rawH,
  );
  const svgW    = SCREEN_W;
  const svgH    = canvasH;
  const offsetX = (svgW - rawW * scale) / 2;
  const offsetY = (svgH - rawH * scale) / 2;

  return { minX, minY, maxX, maxY, rawW, rawH, scale, offsetX, offsetY, svgW, svgH };
}

function tx(raw: number, min: number, scale: number, offset: number): number {
  return (raw - min) * scale + offset;
}

function toSvgPoints(points: SectorPoint[], bbox: BBox): string {
  return points
    .map((p) => `${tx(p.X, bbox.minX, bbox.scale, bbox.offsetX)},${tx(p.Y, bbox.minY, bbox.scale, bbox.offsetY)}`)
    .join(" ");
}

function centroidSvg(points: SectorPoint[], bbox: BBox): { x: number; y: number } {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + tx(p.X, bbox.minX, bbox.scale, bbox.offsetX), 0) / n,
    y: points.reduce((s, p) => s + tx(p.Y, bbox.minY, bbox.scale, bbox.offsetY), 0) / n,
  };
}

// ─── PULSE RING ───────────────────────────────────────────────────────────────
function PulseRing({ color, active }: { color: string; active: boolean }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.9, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:     "absolute",
        width:        24,
        height:       24,
        borderRadius: 12,
        borderWidth:  1,
        borderColor:  color,
        opacity:      0.28,
        transform:    [{ scale: anim }],
      }}
    />
  );
}

// ─── MACHINE NODE ─────────────────────────────────────────────────────────────
function MachineNode({
  machine,
  bbox,
  onPress,
}: {
  machine: Machine;
  bbox:    BBox;
  onPress: (m: Machine) => void;
}) {
  const color = STATUS_COLOR[machine.status] ?? C.idle;
  const cx    = tx(machine.posX, bbox.minX, bbox.scale, bbox.offsetX);
  const cy    = tx(machine.posY, bbox.minY, bbox.scale, bbox.offsetY);
  const SIZE  = 26;

  return (
    <TouchableOpacity
      onPress={() => onPress(machine)}
      activeOpacity={0.75}
      style={{
        position:       "absolute",
        left:           cx - SIZE / 2,
        top:            cy - SIZE / 2,
        width:          SIZE,
        height:         SIZE,
        alignItems:     "center",
        justifyContent: "center",
      }}
    >
      <PulseRing color={color} active={machine.status === "active" || machine.status === "error"} />

      <View
        style={{
          width:           22,
          height:          22,
          borderRadius:    4,
          backgroundColor: "rgba(8,18,36,0.92)",
          borderWidth:     1.5,
          borderColor:     color,
          alignItems:      "center",
          justifyContent:  "center",
        }}
      >
        <Text style={{ fontSize: 6, color, fontWeight: "800", letterSpacing: 0.2 }}>
          {machine.model.slice(0, 3).toUpperCase()}
        </Text>
      </View>

      <View
        style={{
          position:        "absolute",
          top:             1,
          right:           1,
          width:           7,
          height:          7,
          borderRadius:    3.5,
          backgroundColor: color,
          borderWidth:     1,
          borderColor:     C.bg,
        }}
      />
    </TouchableOpacity>
  );
}

// ─── MACHINE MODAL ────────────────────────────────────────────────────────────
function MachineModal({
  machine,
  visible,
  onClose,
}: {
  machine: Machine | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!machine) return null;
  const color = STATUS_COLOR[machine.status] ?? C.idle;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.sheetHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.sheetModel}>{machine.model.toUpperCase()}</Text>
              <Text style={s.sheetName} numberOfLines={1}>{machine.name}</Text>
            </View>
            <View style={[s.badge, { borderColor: color, backgroundColor: hexToRgba(color, 0.1) }]}>
              <View style={[s.badgeDot, { backgroundColor: color }]} />
              <Text style={[s.badgeText, { color }]}>
                {STATUS_LABEL[machine.status] ?? machine.status}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.infoGrid}>
            {[
              { label: "ID",      value: machine.id.split("-")[0].toUpperCase() },
              { label: "Modelo",  value: machine.model },
              { label: "Status",  value: STATUS_LABEL[machine.status] ?? machine.status },
              { label: "Posição", value: `${machine.posX} × ${machine.posY}` },
            ].map((item) => (
              <View key={item.label} style={s.infoItem}>
                <Text style={s.infoLabel}>{item.label}</Text>
                <Text style={s.infoValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── SECTOR LAYER (SVG) ───────────────────────────────────────────────────────
function SectorLayer({
  sectors,
  machines,
  bbox,
}: {
  sectors:  Sector[];
  machines: Machine[];
  bbox:     BBox;
}) {
  return (
    <Svg width={bbox.svgW} height={bbox.svgH} style={StyleSheet.absoluteFillObject}>
      {/* Dot grid */}
      {Array.from({ length: 22 }).map((_, row) =>
        Array.from({ length: 18 }).map((_, col) => (
          <Circle
            key={`dot-${row}-${col}`}
            cx={(col / 17) * bbox.svgW}
            cy={(row / 21) * bbox.svgH}
            r={1.2}
            fill="rgba(100,160,220,0.13)"
          />
        )),
      )}

      {/* Sectors */}
      {sectors.map((sector) => {
        const pts         = toSvgPoints(sector.points, bbox);
        const ctr         = centroidSvg(sector.points, bbox);
        const topY        = Math.min(...sector.points.map((p) => tx(p.Y, bbox.minY, bbox.scale, bbox.offsetY)));
        const sectorMachines = machines.filter((m) => m.sectorId === sector.id);
        const hasError    = sectorMachines.some((m) => m.status === "error");
        const hasWarning  = sectorMachines.some((m) => m.status === "warning");
        const borderColor = hasError ? C.error : hasWarning ? C.warning : sector.color;
        const labelW      = Math.max(sector.name.length * 7 + 20, 60);

        return (
          <G key={sector.id}>
            <Polygon
              points={pts}
              fill={hexToRgba(sector.color, 0.15)}
              stroke={borderColor}
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
            {sector.points.map((pt, i) => (
              <Circle
                key={`corner-${i}`}
                cx={tx(pt.X, bbox.minX, bbox.scale, bbox.offsetX)}
                cy={tx(pt.Y, bbox.minY, bbox.scale, bbox.offsetY)}
                r={3}
                fill={borderColor}
                opacity={0.65}
              />
            ))}
            <Rect
              x={ctr.x - labelW / 2}
              y={topY + 7}
              width={labelW}
              height={16}
              rx={4}
              fill="rgba(8,16,32,0.78)"
            />
          </G>
        );
      })}
    </Svg>
  );
}

// ─── SECTOR LABELS (native RN Text — correct font rendering) ─────────────────
function SectorLabels({ sectors, bbox }: { sectors: Sector[]; bbox: BBox }) {
  return (
    <>
      {sectors.map((sector) => {
        const ctr    = centroidSvg(sector.points, bbox);
        const topY   = Math.min(...sector.points.map((p) => tx(p.Y, bbox.minY, bbox.scale, bbox.offsetY)));
        const labelW = Math.max(sector.name.length * 7 + 20, 60);

        return (
          <View
            key={`label-${sector.id}`}
            pointerEvents="none"
            style={{
              position:       "absolute",
              left:           ctr.x - labelW / 2,
              top:            topY + 7,
              width:          labelW,
              height:         16,
              alignItems:     "center",
              justifyContent: "center",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color:         sector.color,
                fontSize:      9,
                fontWeight:    "700",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              {sector.name}
            </Text>
          </View>
        );
      })}
    </>
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TOP_BAR_H = 96;
const STRIP_H   = 50;

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function FloorPlanScreen() {
  // Params recebidos via router.push({ pathname, params }) vindos de LabsScreen
  const { plantId, labName } = useLocalSearchParams<{
    plantId:          string;
    labName:          string;
    plantDescription: string;
    scale:            string;
    widthUnits:       string;
    heightUnits:      string;
  }>();

  const router = useRouter();

  const [plant,    setPlant]    = useState<Plant | null>(null);
  const [sectors,  setSectors]  = useState<Sector[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [modalOn,  setModalOn]  = useState(false);
  const [legendOn, setLegendOn] = useState(false);

  const load = useCallback(async () => {
    if (!plantId) {
      setError("ID da planta não informado.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [p, sec, mach] = await Promise.all([
        fetchPlant(plantId),
        fetchSectors(plantId),
        fetchMachines(plantId),
      ]);

      setPlant(p);
      setSectors(sec);
      setMachines(mach);
    } catch (e: any) {
      setError(e.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  useEffect(() => { load(); }, [load]);

  const canvasH = SCREEN_H - TOP_BAR_H - STRIP_H;

  const bbox: BBox | null =
    sectors.length > 0 ? computeBBox(sectors, machines, canvasH) : null;

  const stats = {
    active:  machines.filter((m) => m.status === "active").length,
    warning: machines.filter((m) => m.status === "warning").length,
    error:   machines.filter((m) => m.status === "error").length,
    idle:    machines.filter((m) => m.status === "idle").length,
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator color={C.sectorLabel} size="large" />
        <Text style={s.loadingText}>Carregando planta...</Text>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={s.errorText}>⚠  {error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/Labs")} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.muted} />
          </TouchableOpacity>
          <View>
            <Text style={s.appName}>LabControl</Text>
            <Text style={s.plantName} numberOfLines={1}>
              {plant?.name ?? labName ?? "—"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={s.liveDot} />
        </View>
      </View>

      {/* ── Status strip ── */}
      <View style={s.strip}>
        {([
          { label: "Ativos",   value: stats.active,  color: C.active  },
          { label: "Alertas",  value: stats.warning, color: C.warning },
          { label: "Falhas",   value: stats.error,   color: C.error   },
          { label: "Inativos", value: stats.idle,    color: C.idle    },
        ] as const).map((item) => (
          <View key={item.label} style={s.stripItem}>
            <Text style={[s.stripVal, { color: item.color }]}>{item.value}</Text>
            <Text style={s.stripLbl}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Canvas ── */}
      <View style={[s.canvas, { height: canvasH }]}>
        {bbox && (
          <>
            <SectorLayer sectors={sectors} machines={machines} bbox={bbox} />
            <SectorLabels sectors={sectors} bbox={bbox} />
            {machines.map((machine) => (
              <MachineNode
                key={machine.id}
                machine={machine}
                bbox={bbox}
                onPress={(m) => { setSelected(m); setModalOn(true); }}
              />
            ))}
          </>
        )}

        {/* Legend toggle */}
        <TouchableOpacity style={s.legendBtn} onPress={() => setLegendOn((v) => !v)}>
          <Text style={{ color: C.sectorLabel, fontSize: 15 }}>⬡</Text>
        </TouchableOpacity>

        {legendOn && (
          <View style={s.legendPanel}>
            <Text style={s.legendTitle}>LEGENDA</Text>
            {(Object.keys(STATUS_LABEL) as MachineStatus[]).map((key) => (
              <View key={key} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: STATUS_COLOR[key] }]} />
                <Text style={s.legendLabel}>{STATUS_LABEL[key]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <MachineModal
        machine={selected}
        visible={modalOn}
        onClose={() => setModalOn(false)}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },

  loadingText: { color: C.muted, fontSize: 13, marginTop: 8 },
  errorText:   { color: C.error, fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
  retryBtn:    { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.panelBorder },
  retryText:   { color: C.sectorLabel, fontSize: 13 },

  topBar: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingHorizontal: 18,
    paddingTop:        50,
    paddingBottom:     10,
    borderBottomWidth: 1,
    borderBottomColor: C.panelBorder,
  },
  appName:   { color: C.muted,  fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  plantName: { color: C.white,  fontSize: 17, fontWeight: "700",  marginTop: 1, maxWidth: SCREEN_W * 0.55 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: C.active },
  liveText:  { color: C.active, fontSize: 10, fontWeight: "700",  letterSpacing: 1.2 },

  strip: {
    flexDirection:     "row",
    backgroundColor:   C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.panelBorder,
    paddingVertical:   10,
  },
  stripItem: { flex: 1, alignItems: "center" },
  stripVal:  { fontSize: 20, fontWeight: "700", lineHeight: 24 },
  stripLbl:  { color: C.muted, fontSize: 10, marginTop: 1, letterSpacing: 0.4 },

  canvas: { width: SCREEN_W, backgroundColor: C.canvas },

  legendBtn: {
    position:        "absolute",
    bottom:          20,
    left:            16,
    width:           38,
    height:          38,
    borderRadius:    8,
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.panelBorder,
    alignItems:      "center",
    justifyContent:  "center",
  },
  legendPanel: {
    position:        "absolute",
    bottom:          66,
    left:            16,
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.panelBorder,
    borderRadius:    8,
    padding:         12,
    minWidth:        128,
  },
  legendTitle: { color: C.muted,  fontSize: 9,  letterSpacing: 1.2, marginBottom: 8, fontWeight: "600" },
  legendRow:   { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: C.white, fontSize: 12 },

  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor:      C.panel,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    padding:              20,
    paddingBottom:        36,
    borderTopWidth:       1,
    borderTopColor:       C.panelBorder,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf:       "center",
    marginBottom:    16,
  },
  sheetHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  sheetModel:   { color: C.muted,  fontSize: 11, letterSpacing: 1.5, marginBottom: 3 },
  sheetName:    { color: C.white,  fontSize: 20, fontWeight: "700" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  badgeText:    { fontSize: 12, fontWeight: "600" },
  divider:      { height: 1, backgroundColor: C.panelBorder, marginBottom: 16 },
  infoGrid:     { flexDirection: "row", flexWrap: "wrap", marginBottom: 24, gap: 12 },
  infoItem:     { width: "45%", gap: 3 },
  infoLabel:    { color: C.muted,  fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  infoValue:    { color: C.white,  fontSize: 15, fontWeight: "600" },
  closeBtn:     { backgroundColor: "rgba(80,160,255,0.1)", borderRadius: 10, borderWidth: 1, borderColor: C.panelBorder, paddingVertical: 13, alignItems: "center" },
  closeBtnText: { color: C.sectorLabel, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
});