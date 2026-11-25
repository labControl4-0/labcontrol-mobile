import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { BottomNavBar } from "../../components/BottomNavBar";
import PlantLocationMap from "../../components/PlantLocationMap";
import {
  getPlantLocationDrafts,
  savePlantLocationDraft,
  type PlantLocationDraft,
} from "../../../lib/offline/plantLocationRepository";
import { getAuthSession } from "../../../lib/auth";
import type { Plant } from "../../../types/plant";
import type { PlantLocationMarker } from "../../../types/plantLocation";
import { getPlantsCached } from "../../../services/catalogService";
import { syncPendingPlantLocations } from "../../../services/plantLocationSync";

type CapturedPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

function getCurrentPositionWithTimeout(): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("O GPS demorou mais de 20 segundos. Tente novamente.")),
      20_000
    );

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

function formatPosition(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function findDraft(drafts: PlantLocationDraft[], plant: Plant) {
  return drafts.find((draft) => draft.userId === plant.userId && draft.plantId === plant.id);
}

export default function PlantLocationsMapScreen() {
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [drafts, setDrafts] = useState<PlantLocationDraft[]>([]);
  const [previews, setPreviews] = useState<Record<string, CapturedPosition>>({});
  const [cacheSource, setCacheSource] = useState<"network" | "cache" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyPlantId, setBusyPlantId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [catalog, session] = await Promise.all([getPlantsCached(), getAuthSession()]);
      setPlants(catalog.data);
      setCacheSource(catalog.source);
      const userId = session?.user.id;
      setDrafts(userId ? await getPlantLocationDrafts(userId) : []);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Falha ao carregar plantas.");
      setLoadError(true);
      Toast.show({
        type: "error",
        text1: "Não foi possível carregar as plantas",
        text2: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const markers = useMemo<PlantLocationMarker[]>(() => {
    const result: PlantLocationMarker[] = [];
    for (const plant of plants) {
      const draft = findDraft(drafts, plant);
      const preview = previews[plant.id];
      const position = preview ?? draft ?? plant;
      if (typeof position.latitude !== "number" || typeof position.longitude !== "number") continue;
      result.push({
        id: plant.id,
        name: plant.name,
        latitude: position.latitude,
        longitude: position.longitude,
        state: preview ? "preview" : draft ? "pending" : "saved",
      });
    }
    return result;
  }, [drafts, plants, previews]);

  const capturePosition = async (plant: Plant) => {
    if (busyPlantId) return;
    setBusyPlantId(plant.id);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permissão de localização negada",
          text2: "Sem a posição, a planta continua disponível normalmente.",
        });
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error("Ative a localização do aparelho e tente novamente.");
      }

      const position = await getCurrentPositionWithTimeout();
      const captured: CapturedPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date().toISOString(),
      };
      setPreviews((current) => ({ ...current, [plant.id]: captured }));
      const accuracyText =
        captured.accuracyMeters == null
          ? "Precisão não informada pelo aparelho."
          : `Precisão aproximada: ±${Math.round(captured.accuracyMeters)} m.`;
      Toast.show({
        type: "success",
        text1: "Posição capturada",
        text2: accuracyText,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Não foi possível obter a localização",
        text2: error instanceof Error ? error.message : "Verifique o GPS e tente novamente.",
      });
    } finally {
      setBusyPlantId(null);
    }
  };

  const savePosition = async (plant: Plant) => {
    const captured = previews[plant.id];
    if (!captured || busyPlantId) return;

    setBusyPlantId(plant.id);
    const draft: PlantLocationDraft = {
      userId: plant.userId,
      plantId: plant.id,
      latitude: captured.latitude,
      longitude: captured.longitude,
      accuracyMeters: captured.accuracyMeters,
      capturedAt: captured.capturedAt,
    };

    try {
      // Grava primeiro no SQLite. Se a API falhar, a posição fica aguardando envio.
      await savePlantLocationDraft(draft);
      setDrafts((current) => [
        ...current.filter((item) => item.userId !== draft.userId || item.plantId !== draft.plantId),
        draft,
      ]);

      await syncPendingPlantLocations();
      const [latestPlants, latestDrafts] = await Promise.all([
        getPlantsCached(),
        getPlantLocationDrafts(draft.userId),
      ]);
      setPlants(latestPlants.data);
      setCacheSource(latestPlants.source);
      setDrafts(latestDrafts);

      const isPending = latestDrafts.some(
        (item) => item.plantId === draft.plantId && item.userId === draft.userId
      );
      if (isPending) {
        Toast.show({
          type: "info",
          text1: "Posição salva neste aparelho",
          text2: "Será sincronizada quando a conexão com o backend voltar.",
        });
      } else {
        setPlants((current) =>
          current.map((item) =>
            item.id === plant.id
              ? { ...item, latitude: captured.latitude, longitude: captured.longitude }
              : item
          )
        );
        setPreviews((current) => {
          const next = { ...current };
          delete next[plant.id];
          return next;
        });
        Toast.show({ type: "success", text1: "Localização da planta sincronizada." });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Não foi possível guardar a posição",
        text2: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusyPlantId(null);
    }
  };

  const retryPending = async (plant: Plant) => {
    if (busyPlantId) return;
    setBusyPlantId(plant.id);
    try {
      await syncPendingPlantLocations();
      const [catalog, latestDrafts] = await Promise.all([
        getPlantsCached(),
        getPlantLocationDrafts(plant.userId),
      ]);
      setPlants(catalog.data);
      setCacheSource(catalog.source);
      setDrafts(latestDrafts);
      const stillPending = latestDrafts.some((draft) => draft.plantId === plant.id);
      Toast.show(
        stillPending
          ? { type: "info", text1: "Ainda sem conexão com o backend." }
          : { type: "success", text1: "Localização sincronizada." }
      );
    } catch {
      Toast.show({
        type: "error",
        text1: "Não foi possível sincronizar",
        text2: "A posição continua guardada neste aparelho.",
      });
    } finally {
      setBusyPlantId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Voltar para laboratórios"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Mapa geográfico</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          Registre a posição fixa de cada planta. O GPS só é consultado quando você toca em capturar.
        </Text>

        {cacheSource === "cache" && (
          <View style={styles.cacheNotice}>
            <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
            <Text style={styles.cacheNoticeText}>
              Exibindo a última cópia disponível. Capturas novas ficam pendentes até a conexão voltar.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.stateText}>Carregando plantas...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>Não foi possível buscar as plantas.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadData()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.mapCard}>
              <PlantLocationMap markers={markers} />
              <Text style={styles.mapCaption}>
                Vermelho: salvo · Laranja: aguardando sincronização · Azul: captura ainda não salva
              </Text>
              <Text style={styles.attribution}>Mapa © OpenStreetMap contributors · requer internet</Text>
            </View>

            <Text style={styles.sectionTitle}>Plantas</Text>
            {plants.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="business-outline" size={34} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Nenhuma planta encontrada</Text>
                <Text style={styles.stateText}>
                  Cadastre uma planta ou conecte-se para carregar os dados.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {plants.map((plant) => {
                  const draft = findDraft(drafts, plant);
                  const preview = previews[plant.id];
                  const latitude = preview?.latitude ?? draft?.latitude ?? plant.latitude;
                  const longitude = preview?.longitude ?? draft?.longitude ?? plant.longitude;
                  const isBusy = busyPlantId === plant.id;

                  return (
                    <View key={plant.id} style={styles.plantCard}>
                      <View style={styles.plantHeading}>
                        <View style={styles.plantIcon}>
                          <Ionicons name="business-outline" size={19} color="#2563EB" />
                        </View>
                        <View style={styles.plantHeadingText}>
                          <Text style={styles.plantName}>{plant.name}</Text>
                          <Text style={styles.plantDescription} numberOfLines={2}>
                            {plant.description || "Sem descrição"}
                          </Text>
                        </View>
                      </View>

                      {typeof latitude === "number" && typeof longitude === "number" ? (
                        <Text style={styles.coordinateText}>
                          {formatPosition(latitude, longitude)}
                        </Text>
                      ) : (
                        <Text style={styles.noCoordinates}>Ainda sem localização geográfica.</Text>
                      )}

                      {preview && (
                        <Text style={styles.statusPreview}>
                          Captura não salva · precisão{" "}
                          {preview.accuracyMeters == null
                            ? "não informada"
                            : `±${Math.round(preview.accuracyMeters)} m`}
                        </Text>
                      )}
                      {draft && !preview && (
                        <Text style={styles.statusPending}>Posição pendente de sincronização.</Text>
                      )}

                      <View style={styles.actions}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={isBusy}
                          style={[styles.secondaryButton, isBusy && styles.disabledButton]}
                          onPress={() => void capturePosition(plant)}
                        >
                          {isBusy && busyPlantId === plant.id ? (
                            <ActivityIndicator color="#1D4ED8" />
                          ) : (
                            <Text style={styles.secondaryButtonText}>
                              {plant.latitude == null ? "Capturar posição" : "Atualizar posição"}
                            </Text>
                          )}
                        </TouchableOpacity>

                        {preview ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={isBusy}
                            style={[styles.primaryButton, isBusy && styles.disabledButton]}
                            onPress={() => void savePosition(plant)}
                          >
                            <Text style={styles.primaryButtonText}>Salvar posição</Text>
                          </TouchableOpacity>
                        ) : draft ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={isBusy}
                            style={[styles.primaryButton, isBusy && styles.disabledButton]}
                            onPress={() => void retryPending(plant)}
                          >
                            <Text style={styles.primaryButtonText}>Tentar sincronizar</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <BottomNavBar activeTab="labs" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 132 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 36 },
  title: { color: "#111827", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#6B7280", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  cacheNotice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", padding: 12, borderRadius: 12, marginBottom: 12 },
  cacheNoticeText: { color: "#92400E", fontSize: 12, lineHeight: 17, flex: 1 },
  mapCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 10, marginBottom: 20 },
  mapCaption: { color: "#4B5563", fontSize: 11, lineHeight: 16, marginTop: 8 },
  attribution: { color: "#6B7280", fontSize: 10, marginTop: 4, textAlign: "right" },
  sectionTitle: { color: "#111827", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  list: { gap: 12 },
  plantCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 15 },
  plantHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  plantIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  plantHeadingText: { flex: 1 },
  plantName: { color: "#111827", fontSize: 15, fontWeight: "700" },
  plantDescription: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  coordinateText: { marginTop: 12, color: "#374151", fontSize: 13, fontVariant: ["tabular-nums"] },
  noCoordinates: { marginTop: 12, color: "#6B7280", fontSize: 12 },
  statusPreview: { marginTop: 5, color: "#1D4ED8", fontSize: 11 },
  statusPending: { marginTop: 5, color: "#B45309", fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  secondaryButton: { minHeight: 40, justifyContent: "center", alignItems: "center", paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#BFDBFE" },
  secondaryButtonText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  primaryButton: { minHeight: 40, justifyContent: "center", alignItems: "center", paddingHorizontal: 13, borderRadius: 10, backgroundColor: "#2563EB" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  disabledButton: { opacity: 0.55 },
  emptyCard: { alignItems: "center", padding: 24, borderRadius: 16, backgroundColor: "#FFFFFF" },
  emptyTitle: { marginTop: 10, marginBottom: 5, color: "#111827", fontSize: 15, fontWeight: "700" },
  stateContainer: { alignItems: "center", paddingVertical: 50 },
  stateText: { marginTop: 8, color: "#6B7280", fontSize: 13, textAlign: "center" },
  retryButton: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: "#2563EB" },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
});
