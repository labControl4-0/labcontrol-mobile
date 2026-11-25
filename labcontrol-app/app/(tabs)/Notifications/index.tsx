import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import { PushSetupCard } from "../../components/PushSetupCard";
import {
  getAllMachineEvents,
  type MachineEvent,
} from "../../../services/notificationServices";

type Tone = "warning" | "success" | "info" | "error";

type NotificationItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  time: string;
  tone: Tone;
};

function getEventTone(event: MachineEvent): Tone {
  if (event.resolved === true || event.isResolved === true) return "success";

  const typeAndSeverity =
    `${event.eventType ?? ""} ${event.severity ?? ""}`.toLowerCase();
  if (/failure|error|critical|falha|erro|cr[ií]tico/.test(typeAndSeverity)) {
    return "error";
  }
  if (/warning|alert|aviso|alerta/.test(typeAndSeverity)) return "warning";
  return "info";
}

function getEventTitle(event: MachineEvent) {
  if (event.title?.trim()) return event.title;

  const type = (event.eventType ?? "").toLowerCase();
  if (/failure|error|falha|erro/.test(type)) return "Falha detectada";
  if (/warning|alert|aviso|alerta/.test(type)) return "Alerta da máquina";
  if (/maintenance|manuten/.test(type)) return "Manutenção";
  return event.eventType || "Evento da máquina";
}

function formatEventTime(value?: string) {
  if (!value) return "Data não informada";

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Data não informada";

  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days} d`;

  return new Date(timestamp).toLocaleDateString("pt-BR");
}

function toNotificationItem(event: MachineEvent): NotificationItem {
  const tone = getEventTone(event);
  const iconByTone: Record<Tone, keyof typeof Ionicons.glyphMap> = {
    warning: "alert-circle-outline",
    success: "checkmark-circle-outline",
    info: "construct-outline",
    error: "close-circle-outline",
  };
  const details =
    event.description?.trim() ||
    event.message?.trim() ||
    event.eventType ||
    "Evento registrado no servidor.";

  return {
    id: event.id,
    icon: iconByTone[tone],
    title: getEventTitle(event),
    subtitle: event.machineName ? `${event.machineName}: ${details}` : details,
    time: formatEventTime(event.createdAt ?? event.timestamp),
    tone,
  };
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const iconColor =
    item.tone === "error"
      ? "#DC2626"
      : item.tone === "warning"
      ? "#F59E0B"
      : item.tone === "success"
      ? "#16A34A"
      : "#2563EB";

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${iconColor}15` },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={22}
          color={iconColor}
        />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.cardTime}>{item.time}</Text>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const backRoute =
    params.from === "profile"
      ? "/UserProfileSettings"
      : "/Dashboard";

  const loadNotifications = useCallback(async () => {
    setError("");
    try {
      const events = await getAllMachineEvents();
      setNotifications(events.map(toNotificationItem));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as notificações."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadNotifications();
  };

  const warningCount = notifications.filter(
    (n) => n.tone === "warning"
  ).length;

  const errorCount = notifications.filter(
    (n) => n.tone === "error"
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push(backRoute as any)}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#111827"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Notifications
          </Text>

          <MaterialCommunityIcons
            name="bell-badge-outline"
            size={22}
            color="#2563EB"
          />
        </View>

        <Text style={styles.description}>
          Acompanhe alertas, falhas, manutenção e eventos
          importantes das máquinas em tempo real.
        </Text>

        <PushSetupCard />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            EVENTOS REGISTRADOS
          </Text>

          <Text style={styles.summaryValue}>
            {loading
              ? "Carregando..."
              : error
                ? "Indisponível"
                : `${notifications.length} notificações`}
          </Text>

          {!loading && !error ? (
            <View style={styles.summaryStats}>
              <View style={styles.stat}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: "#DC2626" },
                  ]}
                />
                <Text style={styles.statText}>
                  {errorCount} erros
                </Text>
              </View>

              <View style={styles.stat}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: "#F59E0B" },
                  ]}
                />
                <Text style={styles.statText}>
                  {warningCount} alertas
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.notificationsList}>
          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.stateText}>Carregando eventos...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateError}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void loadNotifications()}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="notifications-off-outline"
                size={32}
                color="#9CA3AF"
              />
              <Text style={styles.stateTitle}>Nenhum evento encontrado</Text>
              <Text style={styles.stateText}>
                Os eventos das máquinas aparecerão aqui quando forem
                registrados.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <NotificationCard key={item.id} item={item} />
            ))
          )}
        </View>
      </ScrollView>

      <BottomNavBar activeTab="notifications" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 120,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  description: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 18,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },

  summaryLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    letterSpacing: 1,
    fontWeight: "600",
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
  },

  summaryStats: {
    flexDirection: "row",
    marginTop: 14,
    gap: 18,
  },

  stat: {
    flexDirection: "row",
    alignItems: "center",
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },

  statText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },

  notificationsList: {
    gap: 12,
  },

  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },

  stateTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  stateText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  stateError: {
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
  },

  retryButton: {
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  retryButtonText: {
    color: "#1F2937",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 19,
  },

  cardTime: {
    marginTop: 8,
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
});