import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

const notifications = [
  {
    icon: "thermometer",
    title: "Temperature rise detected",
    subtitle: "Lab A1 is now at 27.4°C. Threshold is 26°C.",
    time: "5 min ago",
    tone: "warning",
  },
  {
    icon: "cog-outline",
    title: "Machine 04 resumed operation",
    subtitle: "The cooling unit in Zone 3 completed auto-recovery.",
    time: "12 min ago",
    tone: "success",
  },
  {
    icon: "flash-outline",
    title: "Energy spike recorded",
    subtitle: "Main diagnostics rack consumed 12% more power than usual.",
    time: "26 min ago",
    tone: "info",
  },
  {
    icon: "alert-circle-outline",
    title: "Humidity control check",
    subtitle: "Humidity remained stable in the sterile lab corridor.",
    time: "45 min ago",
    tone: "success",
  },
  {
    icon: "hardware-chip-outline",
    title: "Machine maintenance reminder",
    subtitle: "Calibrator Unit 2 is due for preventive maintenance today.",
    time: "1 h ago",
    tone: "warning",
  },
];

function NotificationCard({ item }: any) {
  const iconColor =
    item.tone === "warning"
      ? "#F59E0B"
      : item.tone === "success"
      ? "#16A34A"
      : "#2563EB";

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={item.icon} size={20} color={iconColor} />
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/Dashboard") }>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notifications</Text>

          <View style={styles.headerRight}>
            <MaterialCommunityIcons name="bell-badge-outline" size={20} color="#2563EB" />
          </View>
        </View>

        <Text style={styles.description}>
          Live alerts from the dashboard, temperature sensors, and machine status.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today</Text>
          <Text style={styles.summaryValue}>5 active notifications</Text>
        </View>

        <View style={styles.list}>
          {notifications.map((item, index) => (
            <NotificationCard key={index} item={item} />
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
});