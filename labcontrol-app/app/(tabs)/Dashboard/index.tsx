import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

const { width } = Dimensions.get("window");

const statsCards = [
  {
    icon: "flash-outline",
    title: "Total Energy",
    value: "450",
    unit: "kW",
    badge: "+5%",
  },
  {
    icon: "thermometer-outline",
    title: "Avg Temp",
    value: "22°",
    unit: "C",
    badge: "+1.2%",
  },
  {
    icon: "cube-outline",
    title: "Active Machines",
    value: "12",
    unit: "/15",
    badge: "Stable",
  },
  {
    icon: "warning-outline",
    title: "System Alerts",
    value: "3",
    unit: "Active",
    badge: "1 New",
  },
];

function StatCard({ item }: any) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name={item.icon} size={16} color="#2563EB" />
        </View>

        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>

      <Text style={styles.cardValue}>
        {item.value}
        <Text style={styles.cardUnit}> {item.unit}</Text>
      </Text>

      <View style={styles.progressLine} />
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />

          <Text style={styles.logo}>LabControl 4.0</Text>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/Notifications" as any)}>
              <Ionicons name="notifications-outline" size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/UserProfileSettings")}
              style={styles.avatarMini}
            >
              <Text style={styles.avatarLetter}>I</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.greeting}>Good morning, Dr. Vince</Text>
        <Text style={styles.pageTitle}>Facility Overview</Text>

        {/* Stats */}
        <View style={styles.grid}>
          {statsCards.map((item, index) => (
            <StatCard key={index} item={item} />
          ))}
        </View>

        {/* Energy Trends */}
        <View style={styles.largeCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Energy Trends</Text>
              <Text style={styles.sectionSubtitle}>Consumption over last 24h</Text>
            </View>
            <Feather name="more-horizontal" size={18} color="#6B7280" />
          </View>

          <View style={styles.chartArea}>
            <View style={styles.fakeLine} />
          </View>
        </View>

        {/* Lab Temperature */}
        <View style={styles.largeCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Lab Temperature</Text>
              <Text style={styles.sectionSubtitle}>Zone distribution</Text>
            </View>
            <Text style={styles.normalText}>● Normal</Text>
          </View>

          <View style={styles.barChartRow}>
            {[60, 85, 40, 90, 70].map((h, i) => (
              <View key={i} style={styles.barColumn}>
                <View style={[styles.barTop, { height: h }]} />
                <View style={styles.barBottom} />
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <BottomNavBar activeTab="dashboard" />
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
    marginBottom: 20,
  },
  headerSpacer: {
    width: 24,
    height: 24,
  },
  logo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F4C7B5",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: { fontSize: 11, fontWeight: "700" },
  greeting: {
    fontSize: 12,
    color: "#6B7280",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  badgePill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    color: "#16A34A",
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  cardUnit: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressLine: {
    height: 4,
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    marginTop: 14,
    width: "70%",
  },
  largeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  chartArea: {
    height: 170,
    justifyContent: "center",
    marginTop: 14,
  },
  fakeLine: {
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  normalText: {
    fontSize: 11,
    color: "#2563EB",
  },
  barChartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 20,
    height: 140,
  },
  barColumn: {
    width: 26,
    alignItems: "center",
  },
  barTop: {
    width: 24,
    backgroundColor: "#C7D2FE",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barBottom: {
    width: 24,
    height: 20,
    backgroundColor: "#2563EB",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});
