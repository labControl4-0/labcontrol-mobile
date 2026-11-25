// Mapa das máquinas (geolocalização).
//
// Fluxo do material "Expo e Java: Geolocalização e Mapas" adaptado ao LabControl:
//   Minha localização  -> expo-location (posição do usuário, marcador azul)
//   Carregar máquinas  -> API (com cache offline) + posições fixadas no aparelho
//   Fixar aqui         -> grava a posição de uma máquina (ação explícita)
//   Distância          -> Haversine, em linha reta
// Máquinas de exemplo (fictícias) podem ser ligadas para demonstrar sem backend.
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import LocationMap from "../../../components/geo/LocationMap";
import { BottomNavBar } from "../../components/BottomNavBar";
import { OfflineBanner } from "../../components/OfflineBanner";
import { getAuthSession } from "../../../lib/auth";
import {
  formatAccuracy,
  formatCoordinates,
  formatDistance,
  isValidCoordinates,
  type Coordinates,
} from "../../../lib/geo/distance";
import { getCurrentPosition, LocationError, type GeoPosition } from "../../../lib/geo/location";
import {
  deleteMachineLocation,
  listMachineLocations,
  saveMachineLocation,
} from "../../../lib/geo/machineLocationRepository";
import {
  buildMachineGeoView,
  nearestMachine,
  type CatalogEntry,
  type CatalogMachine,
  type LocatedMachine,
  type PinnedLocation,
  type UnlocatedMachine,
} from "../../../lib/geo/machineGeo";
import {
  buildMapPoints,
  MAP_COLORS,
  occurrencePoint,
  STATUS_COLOR,
  STATUS_LABEL,
  type MapFocus,
} from "../../../lib/geo/mapPoints";
import { buildSampleMachines, DEFAULT_SAMPLE_ANCHOR } from "../../../lib/geo/sampleMachines";
import { ApiError } from "../../../services/api";
import { getMachinesByPlantCached, getPlantsCached } from "../../../services/catalogService";

/** Abaixo disso a posição serve para fixar uma máquina sem aviso. */
const GOOD_ACCURACY_M = 50;

const param = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

type PlantSummary = { id: string; name?: string };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof LocationError || error instanceof ApiError) return error.message;
  return fallback;
}

function Legend() {
  const items = [
    { label: "Você", color: MAP_COLORS.me },
    { label: "Ativo", color: STATUS_COLOR.active },
    { label: "Atenção", color: STATUS_COLOR.warning },
    { label: "Erro", color: STATUS_COLOR.error },
    { label: "Inativo", color: STATUS_COLOR.idle },
    { label: "Ocorrência", color: MAP_COLORS.occurrence },
  ];
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const SOURCE_CHIP: Record<LocatedMachine["source"], { text: string; color: string }> = {
  api: { text: "API", color: "#2563EB" },
  device: { text: "Fixada aqui", color: "#0F766E" },
  sample: { text: "Exemplo", color: "#7C3AED" },
};

export default function MachineMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Ocorrência aberta a partir da lista (marcador roxo).
  const occurrenceFocus = useMemo(() => {
    const candidate = {
      latitude: Number(param(params.focusLat)),
      longitude: Number(param(params.focusLng)),
    };
    if (!param(params.focusLat) || !isValidCoordinates(candidate)) return null;
    const accuracy = Number(param(params.focusAccuracy));
    return {
      ...candidate,
      id: param(params.focusId) || "ocorrencia",
      label: param(params.focusLabel) || "Ocorrência",
      accuracy: param(params.focusAccuracy) && Number.isFinite(accuracy) ? accuracy : null,
    };
  }, [params.focusLat, params.focusLng, params.focusId, params.focusLabel, params.focusAccuracy]);

  const [userId, setUserId] = useState<string | null>(null);
  const [here, setHere] = useState<GeoPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [pinned, setPinned] = useState<PinnedLocation[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [machinesError, setMachinesError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);

  const [showSamples, setShowSamples] = useState(true);
  // As máquinas de exemplo ficam ao redor da primeira posição obtida (ou do
  // ponto fictício do material), e não se movem quando o usuário anda.
  const [sampleAnchor, setSampleAnchor] = useState<Coordinates>(DEFAULT_SAMPLE_ANCHOR);
  const [anchoredOnUser, setAnchoredOnUser] = useState(false);

  const [focus, setFocus] = useState<MapFocus | null>(() =>
    occurrenceFocus ? { ...occurrenceFocus, zoom: 17, key: 1 } : null
  );
  const [busyMachineId, setBusyMachineId] = useState<string | null>(null);

  const focusOn = useCallback((c: Coordinates, zoom = 17) => {
    setFocus((current) => ({ latitude: c.latitude, longitude: c.longitude, zoom, key: (current?.key ?? 0) + 1 }));
  }, []);

  const loadMachines = useCallback(async () => {
    setLoadingMachines(true);
    setMachinesError(null);

    const session = await getAuthSession().catch(() => null);
    const currentUser = session?.user.id ?? null;
    setUserId(currentUser);

    if (currentUser) {
      setPinned(await listMachineLocations(currentUser).catch(() => []));
    }

    try {
      const cachedDates: string[] = [];
      const plantsResult = await getPlantsCached();
      if (plantsResult.source === "cache" && plantsResult.cachedAt) cachedDates.push(plantsResult.cachedAt);
      const plants = plantsResult.data as PlantSummary[];

      const groups = await Promise.all(
        plants.map(async (plant) => {
          try {
            const result = await getMachinesByPlantCached(plant.id);
            if (result.source === "cache" && result.cachedAt) cachedDates.push(result.cachedAt);
            return (result.data as unknown as CatalogMachine[]).map((machine) => ({
              machine,
              plantName: plant.name ?? null,
            }));
          } catch (error) {
            if (error instanceof ApiError && error.code === "unauthorized") throw error;
            return [];
          }
        })
      );

      setCatalog(groups.flat());
      setOfflineSince(cachedDates.length > 0 ? cachedDates.sort()[0] : null);
    } catch (error) {
      setCatalog([]);
      setMachinesError(
        errorMessage(error, "Não foi possível carregar as máquinas do servidor.")
      );
    } finally {
      setLoadingMachines(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMachines();
    }, [loadMachines])
  );

  const locateMe = useCallback(async (): Promise<GeoPosition | null> => {
    if (locating) return null;
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentPosition();
      setHere(position);
      if (!anchoredOnUser) {
        setSampleAnchor(position);
        setAnchoredOnUser(true);
      }
      return position;
    } catch (error) {
      setLocationError(errorMessage(error, "Não foi possível obter a localização."));
      return null;
    } finally {
      setLocating(false);
    }
  }, [locating, anchoredOnUser]);

  const handleLocateMe = async () => {
    const position = await locateMe();
    if (position) focusOn(position);
  };

  const pinHere = async (machine: UnlocatedMachine) => {
    if (!userId) {
      Toast.show({ type: "error", text1: "Sessão expirada", text2: "Faça login novamente." });
      return;
    }
    setBusyMachineId(machine.id);
    try {
      // Sempre uma leitura nova: o usuário precisa estar junto da máquina agora.
      const position = await locateMe();
      if (!position) return;

      await saveMachineLocation(userId, {
        machineId: machine.id,
        machineName: machine.name,
        plantId: machine.plantId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
      });
      setPinned(await listMachineLocations(userId));
      focusOn(position);

      const lowAccuracy = position.accuracy === null || position.accuracy > GOOD_ACCURACY_M;
      Toast.show({
        type: lowAccuracy ? "info" : "success",
        text1: `Posição de ${machine.name} salva no aparelho`,
        text2: lowAccuracy
          ? `Precisão baixa (${formatAccuracy(position.accuracy)}). Se puder, tente de novo em local aberto.`
          : `Precisão ${formatAccuracy(position.accuracy)}.`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Não foi possível salvar a posição",
        text2: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusyMachineId(null);
    }
  };

  const unpin = async (machine: LocatedMachine) => {
    if (!userId) return;
    setBusyMachineId(machine.id);
    try {
      await deleteMachineLocation(userId, machine.id);
      setPinned(await listMachineLocations(userId));
      Toast.show({ type: "info", text1: `Posição de ${machine.name} removida` });
    } catch {
      Toast.show({ type: "error", text1: "Não foi possível remover a posição" });
    } finally {
      setBusyMachineId(null);
    }
  };

  const view = useMemo(
    () =>
      buildMachineGeoView({
        catalog,
        pinned,
        samples: showSamples ? buildSampleMachines(sampleAnchor) : [],
        here,
      }),
    [catalog, pinned, showSamples, sampleAnchor, here]
  );

  const points = useMemo(
    () =>
      buildMapPoints({
        here,
        machines: view.located,
        extra: occurrenceFocus ? [occurrencePoint(occurrenceFocus)] : [],
      }),
    [here, view.located, occurrenceFocus]
  );

  const nearest = nearestMachine(view);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Mapa das máquinas</Text>
          <TouchableOpacity
            onPress={() => void loadMachines()}
            accessibilityLabel="Carregar máquinas de novo"
          >
            <Ionicons name="refresh" size={21} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Veja onde estão as máquinas e a que distância você está de cada uma. Mapa
          OpenStreetMap; distâncias em linha reta.
        </Text>

        {offlineSince && !loadingMachines ? (
          <OfflineBanner cachedAt={offlineSince} onRetry={() => void loadMachines()} />
        ) : null}

        <LocationMap points={points} focus={focus} height={300} />
        <Legend />

        {occurrenceFocus ? (
          <View style={styles.infoBox}>
            <Ionicons name="location" size={16} color={MAP_COLORS.occurrence} />
            <Text style={styles.infoText}>
              {occurrenceFocus.label}: registrada em {formatCoordinates(occurrenceFocus)} (
              {formatAccuracy(occurrenceFocus.accuracy)}).
            </Text>
          </View>
        ) : null}

        {/* ─── Minha localização ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>MINHA LOCALIZAÇÃO</Text>
          {here ? (
            <>
              <Text style={styles.coords}>{formatCoordinates(here)}</Text>
              <Text style={styles.muted}>
                Precisão {formatAccuracy(here.accuracy)} · medida às{" "}
                {new Date(here.timestamp).toLocaleTimeString("pt-BR")}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>Toque no botão para ver sua posição no mapa.</Text>
          )}
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, locating && styles.buttonDisabled]}
            onPress={() => void handleLocateMe()}
            disabled={locating}
            accessibilityRole="button"
          >
            {locating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="locate" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.primaryButtonText}>
              {locating ? "Obtendo posição..." : "Minha localização"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.privacy}>
            Sua posição fica só nesta tela. Ela não é enviada ao servidor.
          </Text>
        </View>

        {/* ─── Exemplos ──────────────────────────────────────────────────── */}
        <View style={[styles.card, styles.row]}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Mostrar máquinas de exemplo</Text>
            <Text style={styles.muted}>
              5 máquinas fictícias{" "}
              {anchoredOnUser ? "ao redor da sua primeira posição" : "num ponto de demonstração"}.
              Não são enviadas ao servidor.
            </Text>
          </View>
          <Switch
            value={showSamples}
            onValueChange={setShowSamples}
            accessibilityLabel="Mostrar máquinas de exemplo"
          />
        </View>

        {nearest ? (
          <View style={styles.infoBox}>
            <Ionicons name="navigate" size={16} color="#2563EB" />
            <Text style={styles.infoText}>
              Mais próxima: {nearest.name} a {formatDistance(nearest.distanceMeters ?? 0)}.
            </Text>
          </View>
        ) : null}

        {/* ─── Máquinas com posição ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>No mapa ({view.located.length})</Text>
        {view.located.length === 0 ? (
          <Text style={styles.empty}>Nenhuma máquina com posição conhecida.</Text>
        ) : (
          <View style={styles.list}>
            {view.located.map((machine) => {
              const chip = SOURCE_CHIP[machine.source];
              const status = machine.status ?? "";
              return (
                <TouchableOpacity
                  key={`${machine.source}:${machine.id}`}
                  style={styles.machineRow}
                  onPress={() => focusOn(machine)}
                  accessibilityRole="button"
                  accessibilityLabel={`Centralizar ${machine.name} no mapa`}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLOR[status] ?? MAP_COLORS.machine },
                    ]}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.machineName}>{machine.name}</Text>
                    <Text style={styles.muted}>
                      {[STATUS_LABEL[status] ?? "Status desconhecido", machine.plantName]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    <View style={styles.chipRow}>
                      <Text style={[styles.chip, { color: chip.color, backgroundColor: `${chip.color}14` }]}>
                        {chip.text}
                      </Text>
                      {machine.source === "device" ? (
                        <TouchableOpacity
                          onPress={() => void unpin(machine)}
                          disabled={busyMachineId === machine.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Remover posição de ${machine.name}`}
                        >
                          <Text style={styles.link}>Remover posição</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.distanceBox}>
                    <Text style={styles.distance}>
                      {machine.distanceMeters !== null ? formatDistance(machine.distanceMeters) : "—"}
                    </Text>
                    {machine.source !== "sample" && machine.sectorId ? (
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/NewOccurrence",
                            params: {
                              machineId: machine.id,
                              machineName: machine.name,
                              sectorId: machine.sectorId ?? "",
                              sectorName: "",
                            },
                          } as any)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Registrar ocorrência em ${machine.name}`}
                      >
                        <Ionicons name="add-circle-outline" size={22} color="#2563EB" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Máquinas sem posição ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Sem localização ({view.unlocated.length})</Text>
        {loadingMachines ? (
          <ActivityIndicator color="#2563EB" style={styles.loading} />
        ) : machinesError ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{machinesError}</Text>
            <Text style={styles.muted}>
              O mapa e as máquinas de exemplo continuam funcionando.
            </Text>
            <TouchableOpacity onPress={() => void loadMachines()} accessibilityRole="button">
              <Text style={styles.link}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : view.unlocated.length === 0 ? (
          <Text style={styles.empty}>
            {catalog.length === 0
              ? "Nenhuma máquina cadastrada no servidor."
              : "Todas as máquinas têm posição."}
          </Text>
        ) : (
          <>
            <Text style={styles.muted}>
              Vá até a máquina e toque em “Fixar aqui” para registrar onde ela está.
            </Text>
            <View style={[styles.list, styles.mtSmall]}>
              {view.unlocated.map((machine) => {
                const busy = busyMachineId === machine.id;
                return (
                  <View key={machine.id} style={styles.machineRow}>
                    <Ionicons name="hardware-chip-outline" size={18} color="#9CA3AF" />
                    <View style={styles.flex}>
                      <Text style={styles.machineName}>{machine.name}</Text>
                      {machine.plantName ? <Text style={styles.muted}>{machine.plantName}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.pinButton, (busy || locating) && styles.buttonDisabled]}
                      onPress={() => void pinHere(machine)}
                      disabled={busy || locating}
                      accessibilityRole="button"
                      accessibilityLabel={`Fixar ${machine.name} na minha posição`}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                      ) : (
                        <Ionicons name="pin" size={15} color="#2563EB" />
                      )}
                      <Text style={styles.pinText}>Fixar aqui</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavBar activeTab="devices" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scroll: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 132 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 14 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "#FFFFFF" },
  legendText: { fontSize: 11, color: "#6B7280" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", letterSpacing: 0.6 },
  coords: { fontSize: 16, fontWeight: "700", color: "#111827" },
  muted: { fontSize: 12, color: "#6B7280", lineHeight: 17 },
  privacy: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  errorText: { fontSize: 13, color: "#B91C1C" },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 2 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoText: { flex: 1, fontSize: 13, color: "#1E3A8A" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 10,
  },
  list: { gap: 10, marginBottom: 16 },
  mtSmall: { marginTop: 10 },
  machineRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  machineName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  chip: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  distanceBox: { alignItems: "flex-end", gap: 6 },
  distance: { fontSize: 14, fontWeight: "700", color: "#111827" },
  link: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  pinText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  empty: { fontSize: 13, color: "#9CA3AF", marginBottom: 16, paddingLeft: 4 },
  loading: { marginVertical: 16 },
});
