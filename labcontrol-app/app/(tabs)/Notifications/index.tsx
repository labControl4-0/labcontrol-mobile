import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import { PushSetupCard } from "../../components/PushSetupCard";
import { OfflineBanner } from "../../components/OfflineBanner";
import {
  getDashboardData,
  type DashboardData,
  type DashboardEvent,
} from "../../../services/dasbhoardServices";

type Tone = "warning" | "success" | "info" | "error";

function getTone(eventType: string, resolved: boolean): Tone {
  if (resolved) return "success";
  const value = eventType.toLocaleLowerCase("pt-BR");
  if (value.includes("error") || value.includes("erro") || value.includes("falha")) return "error";
  if (value.includes("warn") || value.includes("alert") || value.includes("alerta")) return "warning";
  if (value.includes("maint") || value.includes("manuten")) return "info";
  return "warning";
}

function getCategory(eventType: string) {
  const value = eventType.toLocaleLowerCase("pt-BR");
  if (value.includes("error") || value.includes("erro") || value.includes("falha")) return "Falha";
  if (value.includes("warn") || value.includes("alert") || value.includes("alerta")) return "Alerta";
  if (value.includes("maint") || value.includes("manuten")) return "Manutenção";
  return "Evento";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationCard({
  event,
  onPress,
}: {
  event: DashboardEvent;
  onPress: () => void;
}) {
  const tone = getTone(event.eventType, Boolean(event.resolvedAt));
  const color =
    tone === "error" ? "#DC2626" :
    tone === "warning" ? "#D97706" :
    tone === "success" ? "#16A34A" : "#2563EB";
  const icon =
    tone === "error" ? "close-circle-outline" :
    tone === "warning" ? "alert-circle-outline" :
    tone === "success" ? "checkmark-circle-outline" : "construct-outline";

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        "Abrir planta " + event.plantName + " no mapa. " +
        getCategory(event.eventType) + " em " + event.machineName + ". " + event.message
      }
      accessibilityHint="Abre o mapa da planta desta máquina."
      hitSlop={4}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{getCategory(event.eventType)}</Text>
          <Text style={[styles.status, { color }]}>
            {event.resolvedAt ? "Resolvido" : "Em aberto"}
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>{event.message}</Text>
        <Text style={styles.machineName}>{event.machineName} · {event.plantName}</Text>
        <Text style={styles.cardTime}>{formatDateTime(event.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const backRoute = params.from === "profile" ? "/UserProfileSettings" : "/Dashboard";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    setData(null);
    try {
      const result = await getDashboardData();
      if (result.events === null) {
        throw new Error(result.eventsError ?? "Não foi possível carregar os eventos.");
      }
      setData(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os eventos."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadNotifications(true);
  }, [loadNotifications]);

  const events = useMemo(
    () =>
      [...(data?.events ?? [])].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      ),
    [data]
  );
  const openCount = events.filter((event) => !event.resolvedAt).length;
  const resolvedCount = events.length - openCount;

  const openPlantMap = (event: DashboardEvent) => {
    router.push({
      pathname: "/InteractiveFloorPlanMap",
      params: { plantId: event.plantId, labName: event.plantName },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push(backRoute as any)}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alertas e eventos</Text>
          <MaterialCommunityIcons name="bell-badge-outline" size={22} color="#2563EB" />
        </View>

        <Text style={styles.description}>
          Eventos recebidos da API para as máquinas das suas plantas. Toque em um item para abrir a planta no mapa.
        </Text>

        <PushSetupCard />

        {loading ? (
          <View style={styles.stateCard} accessibilityRole="progressbar"
            accessibilityLabel="Carregando alertas e eventos">
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.stateText}>Carregando eventos...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={24} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => void loadNotifications()}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar os eventos novamente"
              style={styles.retryButton}
              hitSlop={8}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {data ? (
          <>
            {data.cachedCatalogAt ? (
              <OfflineBanner
                cachedAt={data.cachedCatalogAt}
                onRetry={() => void loadNotifications()}
              />
            ) : null}
            <Text style={styles.syncText}>Última atualização: {formatDateTime(data.syncedAt)}</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>RESUMO</Text>
              <Text style={styles.summaryValue}>{events.length} eventos</Text>
              <View style={styles.summaryStats}>
                <Text style={styles.statText}>{openCount} em aberto</Text>
                <Text style={styles.statText}>{resolvedCount} resolvidos</Text>
              </View>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptyCard} accessibilityRole="summary">
                <Ionicons name="checkmark-circle-outline" size={30} color="#16A34A" />
                <Text style={styles.emptyTitle}>Nenhum evento registrado</Text>
                <Text style={styles.emptyText}>
                  Não há eventos para as máquinas das plantas carregadas.
                </Text>
              </View>
            ) : (
              <View style={styles.notificationsList}>
                {events.map((event) => (
                  <NotificationCard
                    key={event.id}
                    event={event}
                    onPress={() => openPlantMap(event)}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
      <BottomNavBar activeTab="notifications" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 19, fontWeight: "700", color: "#111827" },
  description: { fontSize: 14, lineHeight: 20, color: "#6B7280", marginBottom: 16 },
  stateCard: { minHeight: 64, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  stateText: { color: "#4B5563", fontSize: 14 },
  errorCard: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 16, padding: 16, gap: 10, marginTop: 16 },
  errorText: { color: "#991B1B", fontSize: 14, lineHeight: 20 },
  retryButton: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 8 },
  retryText: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  syncText: { fontSize: 12, color: "#6B7280", marginBottom: 12 },
  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 16 },
  summaryLabel: { fontSize: 11, color: "#6B7280", letterSpacing: 0.8, fontWeight: "700" },
  summaryValue: { fontSize: 24, fontWeight: "700", color: "#111827", marginTop: 5 },
  summaryStats: { flexDirection: "row", gap: 18, marginTop: 12 },
  statText: { fontSize: 13, color: "#4B5563", fontWeight: "600" },
  notificationsList: { gap: 10 },
  eventCard: { minHeight: 76, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#111827" },
  status: { fontSize: 11, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, lineHeight: 19, color: "#4B5563", marginTop: 5 },
  machineName: { fontSize: 12, color: "#1D4ED8", marginTop: 7 },
  cardTime: { fontSize: 11, color: "#6B7280", marginTop: 5 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { color: "#111827", fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyText: { color: "#6B7280", fontSize: 13, lineHeight: 19, textAlign: "center" },
});
