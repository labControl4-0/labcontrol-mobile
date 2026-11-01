import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

type Tone = "warning" | "success" | "info" | "error";

type NotificationItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  time: string;
  tone: Tone;
};

const notifications: NotificationItem[] = [
  {
    icon: "alert-circle-outline",
    title: "Máquina requer atenção",
    subtitle: "Torno CNC 01 apresentou vibração acima do limite.",
    time: "2 min atrás",
    tone: "warning",
  },
  {
    icon: "close-circle-outline",
    title: "Falha detectada",
    subtitle: "Impressora 3D Ender 3 interrompeu a operação.",
    time: "8 min atrás",
    tone: "error",
  },
  {
    icon: "construct-outline",
    title: "Manutenção programada",
    subtitle: "Fresadora Industrial será inspecionada amanhã.",
    time: "30 min atrás",
    tone: "info",
  },
  {
    icon: "checkmark-circle-outline",
    title: "Problema resolvido",
    subtitle: "Esteira de Separação voltou a operar normalmente.",
    time: "1h atrás",
    tone: "success",
  },
  {
    icon: "thermometer-outline",
    title: "Temperatura elevada",
    subtitle: "Router CNC atingiu 78°C.",
    time: "2h atrás",
    tone: "warning",
  },
  {
    icon: "water-outline",
    title: "Umidade crítica",
    subtitle: "Sensor detectou umidade acima do recomendado.",
    time: "3h atrás",
    tone: "warning",
  },
  {
    icon: "checkmark-done-circle-outline",
    title: "Todos os sistemas operacionais",
    subtitle: "Lab de Automação funcionando normalmente.",
    time: "4h atrás",
    tone: "success",
  },
];

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

  const backRoute =
    params.from === "profile"
      ? "/UserProfileSettings"
      : "/Dashboard";

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

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            RESUMO DE HOJE
          </Text>

          <Text style={styles.summaryValue}>
            {notifications.length} notificações
          </Text>

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
        </View>

        <View style={styles.notificationsList}>
          {notifications.map((item, index) => (
            <NotificationCard
              key={index}
              item={item}
            />
          ))}
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