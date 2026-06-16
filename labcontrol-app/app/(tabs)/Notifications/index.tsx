import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import { apiFetchAuth } from "../../../services/api";

type Tone = "warning" | "success" | "info" | "error";

type NotificationItem = {
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  tone: Tone;
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return `${Math.floor(diffH / 24)}d atrás`;
}

function statusTone(status: string): Tone {
  if (status === "active") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return "info";
}

function statusIconName(status: string): string {
  if (status === "active") return "checkmark-circle-outline";
  if (status === "warning") return "alert-circle-outline";
  if (status === "error") return "close-circle-outline";
  return "ellipse-outline";
}

function labTone(machines: any[]): Tone {
  if (machines.some((m) => m.status === "error")) return "error";
  if (machines.some((m) => m.status === "warning")) return "warning";
  if (machines.some((m) => m.status === "active")) return "success";
  return "info";
}

function labIconName(tone: Tone): string {
  if (tone === "error") return "close-circle-outline";
  if (tone === "warning") return "alert-circle-outline";
  if (tone === "success") return "checkmark-circle-outline";
  return "ellipse-outline";
}

function labSubtitle(machines: any[]): string {
  const active = machines.filter((m) => m.status === "active").length;
  const warning = machines.filter((m) => m.status === "warning").length;
  const error = machines.filter((m) => m.status === "error").length;
  const idle = machines.filter((m) => m.status === "idle").length;
  const parts: string[] = [];
  if (active) parts.push(`${active} ativa(s)`);
  if (warning) parts.push(`${warning} em aviso`);
  if (error) parts.push(`${error} com erro`);
  if (idle) parts.push(`${idle} inativa(s)`);
  return parts.length ? parts.join(", ") : "Nenhuma máquina registrada.";
}

function toneLabel(tone: Tone): string {
  if (tone === "error") return "com erro";
  if (tone === "warning") return "em atenção";
  if (tone === "success") return "ativo";
  return "sem atividade";
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
      <View style={[styles.iconBox, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={item.icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.cardBody}>
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
  const backRoute =
    params.from === "profile" ? "/UserProfileSettings" : "/Dashboard";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const plants: any[] = await apiFetchAuth("/plants");
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const items: NotificationItem[] = [];

        const plantWithMachines = await Promise.all(
          plants.map(async (p) => ({
            plant: p,
            machines: (await apiFetchAuth(`/machines/plant/${p.id}`)) as any[],
          }))
        );

        for (const { plant, machines } of plantWithMachines) {
          const tone = labTone(machines);
          items.push({
            icon: labIconName(tone),
            title: `Lab ${plant.name} — ${toneLabel(tone)}`,
            subtitle: labSubtitle(machines),
            time: "agora",
            tone,
          });

          for (const m of machines) {
            if (new Date(m.createdAt) > yesterday) {
              items.push({
                icon: statusIconName(m.status),
                title: "Nova máquina adicionada",
                subtitle: `${m.name} (${m.model}) — ${m.status}`,
                time: timeAgo(new Date(m.createdAt)),
                tone: statusTone(m.status),
              });
            }
          }
        }

        setNotifications(items);
      } catch (e) {
        console.error("Erro ao carregar notificações:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push(backRoute as any)}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight}>
            <MaterialCommunityIcons
              name="bell-badge-outline"
              size={20}
              color="#2563EB"
            />
          </View>
        </View>

        <Text style={styles.description}>
          Status dos labs e alertas de máquinas em tempo real.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Hoje</Text>
          <Text style={styles.summaryValue}>
            {loading
              ? "Carregando..."
              : `${notifications.length} notificação(ões)`}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#2563EB"
            style={{ marginTop: 32 }}
          />
        ) : (
          <View style={styles.list}>
            {notifications.length === 0 ? (
              <Text style={styles.empty}>Nenhuma notificação no momento.</Text>
            ) : (
              notifications.map((item, i) => (
                <NotificationCard key={i} item={item} />
              ))
            )}
          </View>
        )}
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
    paddingTop: 14,
    paddingBottom: 132,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerRight: {
    width: 24,
    alignItems: "flex-end",
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  summaryTitle: {
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 18,
  },
  cardTime: {
    marginTop: 8,
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 32,
  },
});
