import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  getDashboardData,
  type DashboardData,
} from "../../../services/dasbhoardServices";
import { BottomNavBar } from "../../components/BottomNavBar";
import { OfflineBanner } from "../../components/OfflineBanner";
import { getAuthSession } from "../../../lib/auth";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventCategory(eventType: string) {
  const type = eventType.toLocaleLowerCase("pt-BR");
  if (type.includes("error") || type.includes("erro") || type.includes("falha")) {
    return "Falha";
  }
  if (type.includes("warn") || type.includes("alert") || type.includes("alerta")) {
    return "Alerta";
  }
  if (type.includes("maint") || type.includes("manuten")) {
    return "Manutenção";
  }
  return "Evento";
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard} accessible accessibilityRole="summary"
      accessibilityLabel={title + ": " + value}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={20} color="#2563EB" />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("Usuário");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    setDashboardData(null);

    try {
      const session = await getAuthSession();
      if (!session) {
        router.replace("/");
        return;
      }

      const name =
        (session as any)?.user?.name ??
        (session as any)?.name ??
        (session as any)?.userName;
      if (typeof name === "string" && name.trim()) setUserName(name.trim());

      setDashboardData(await getDashboardData());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados do painel."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadDashboard(true);
  }, [loadDashboard]);

  const recentEvents = useMemo(
    () =>
      [...(dashboardData?.events ?? [])]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 5),
    [dashboardData]
  );

  const openEvents = dashboardData?.events?.filter((event) => !event.resolvedAt).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>LabControl 4.0</Text>
            <Text style={styles.greeting}>Olá, {userName}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push("/UserProfileSettings" as any)}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            hitSlop={8}
          >
            <Ionicons name="person-outline" size={21} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Visão geral</Text>
        <Text style={styles.pageDescription}>
          Acompanhe as plantas, máquinas e ocorrências registradas.
        </Text>

        {loading ? (
          <View style={styles.stateCard} accessibilityRole="progressbar"
            accessibilityLabel="Carregando dados do painel">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.stateText}>Carregando dados...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={22} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadDashboard()}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar o painel novamente"
              hitSlop={8}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {dashboardData ? (
          <>
            {dashboardData.cachedCatalogAt ? (
              <OfflineBanner
                cachedAt={dashboardData.cachedCatalogAt}
                onRetry={() => void loadDashboard()}
              />
            ) : null}
            <Text style={styles.syncText}>
              Última consulta do catálogo: {formatDateTime(dashboardData.syncedAt)}
            </Text>

            <View style={styles.summaryGrid}>
              <SummaryCard title="Plantas" value={dashboardData.plants.length} icon="business-outline" />
              <SummaryCard title="Máquinas" value={dashboardData.machines.length} icon="hardware-chip-outline" />
              <SummaryCard title="Ocorrências abertas" value={openEvents ?? "—"} icon="alert-circle-outline" />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Eventos recentes</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/Notifications" as any)}
                accessibilityRole="button"
                accessibilityLabel="Ver todos os alertas e eventos"
                hitSlop={8}
              >
                <Text style={styles.linkText}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            {dashboardData.events === null ? (
              <View style={styles.errorCard} accessibilityRole="alert">
                <Ionicons name="cloud-offline-outline" size={22} color="#B91C1C" />
                <Text style={styles.errorText}>
                  Eventos indisponíveis. {dashboardData.eventsError ?? "Tente atualizar novamente."}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void loadDashboard()}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar carregar eventos novamente"
                  hitSlop={8}
                >
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : recentEvents.length === 0 ? (
              <View style={styles.emptyCard} accessibilityRole="summary">
                <Ionicons name="checkmark-circle-outline" size={28} color="#16A34A" />
                <Text style={styles.emptyTitle}>Nenhum evento registrado</Text>
                <Text style={styles.emptyText}>
                  Quando houver ocorrências nas máquinas, elas aparecerão aqui.
                </Text>
              </View>
            ) : (
              <View style={styles.eventList}>
                {recentEvents.map((event) => (
                  <View
                    key={event.id}
                    style={styles.eventCard}
                    accessible
                    accessibilityRole="summary"
                    accessibilityLabel={
                      getEventCategory(event.eventType) + " em " + event.machineName +
                      ", planta " + event.plantName + ": " + event.message
                    }
                  >
                    <View style={styles.eventIcon}>
                      <Ionicons
                        name={event.resolvedAt ? "checkmark-circle-outline" : "alert-circle-outline"}
                        size={21}
                        color={event.resolvedAt ? "#16A34A" : "#D97706"}
                      />
                    </View>
                    <View style={styles.eventBody}>
                      <Text style={styles.eventTitle}>
                        {getEventCategory(event.eventType)} · {event.machineName}
                      </Text>
                      <Text style={styles.eventLocation}>{event.plantName}</Text>
                      <Text style={styles.eventMessage}>{event.message}</Text>
                      <Text style={styles.eventMeta}>
                        {event.resolvedAt ? "Resolvido" : "Em aberto"} · {formatDateTime(event.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
      <BottomNavBar activeTab="dashboard" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 132 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  brand: { color: "#2563EB", fontSize: 12, fontWeight: "700", letterSpacing: 0.7 },
  greeting: { color: "#6B7280", fontSize: 13, marginTop: 5 },
  headerButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pageTitle: { color: "#111827", fontSize: 26, fontWeight: "700" },
  pageDescription: { color: "#6B7280", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 18 },
  stateCard: { minHeight: 64, borderRadius: 16, padding: 16, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 10 },
  stateText: { color: "#4B5563", fontSize: 14 },
  errorCard: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  errorText: { color: "#991B1B", fontSize: 14, lineHeight: 20 },
  retryButton: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  retryText: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  syncText: { color: "#6B7280", fontSize: 12, marginBottom: 12 },
  summaryGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, minHeight: 130, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, justifyContent: "center" },
  summaryIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  summaryValue: { color: "#111827", fontSize: 25, fontWeight: "700" },
  summaryTitle: { color: "#6B7280", fontSize: 12, lineHeight: 16, marginTop: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "700" },
  linkText: { color: "#1D4ED8", fontSize: 14, fontWeight: "600", padding: 8 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 22, alignItems: "center", gap: 8 },
  emptyTitle: { color: "#111827", fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyText: { color: "#6B7280", fontSize: 13, lineHeight: 19, textAlign: "center" },
  eventList: { gap: 10 },
  eventCard: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 12 },
  eventIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" },
  eventBody: { flex: 1 },
  eventTitle: { color: "#111827", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  eventLocation: { color: "#2563EB", fontSize: 12, marginTop: 3 },
  eventMessage: { color: "#4B5563", fontSize: 13, lineHeight: 19, marginTop: 5 },
  eventMeta: { color: "#6B7280", fontSize: 11, marginTop: 7 },
});
