import React, { useEffect, useMemo, useState } from "react";
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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  getDashboardData,
  type DashboardData,
} from "../../../services/dasbhoardServices";

import { BottomNavBar } from "../../components/BottomNavBar";
import { getAuthSession } from "../../../lib/auth";

type StatCardItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  unit: string;
  badge: string;
};

type MachineMetric = {
  id?: string;
  machineId?: string;
  temperature?: number;
  temp?: number;
  energyConsumption?: number;
  energy?: number;
  power?: number;
  value?: number;
  name?: string;
  createdAt?: string;
  timestamp?: string;
};

function getMetricEnergy(metric: MachineMetric) {
  return metric.energyConsumption ?? metric.energy ?? metric.power ?? 0;
}

function getMetricTemperature(metric: MachineMetric) {
  return metric.temperature ?? metric.temp ?? null;
}

function calculateBarHeights(values: number[]) {
  if (values.length === 0) {
    return [30, 40, 35, 50, 45];
  }

  const lastValues = values.slice(-5);
  const maxValue = Math.max(...lastValues, 1);

  return lastValues.map((value) =>
    Math.max(25, Math.min(110, (value / maxValue) * 110))
  );
}

function StatCard({ item }: { item: StatCardItem }) {
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

  const [userName, setUserName] = useState("User");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const session = await getAuthSession();

      if (!session) {
        router.replace("/");
        return;
      }

      const sessionName =
        (session as any)?.user?.name ||
        (session as any)?.name ||
        (session as any)?.userName ||
        "User";

      setUserName(sessionName);

      const data = await getDashboardData();

      console.log("DASHBOARD DATA:", data);

      setDashboardData(data);
    } catch (err: any) {
      console.log("ERRO DASHBOARD:", err?.message || err);
      setError(err?.message || "Erro ao carregar dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const totalEnergy = dashboardData?.totalEnergy ?? 0;
  const avgTemp = dashboardData?.avgTemp ?? 0;
  const registeredUsers = dashboardData?.registeredUsers ?? 0;
  const activeAlerts = dashboardData?.activeAlerts ?? 0;

  const metrics = (dashboardData?.metrics ?? []) as MachineMetric[];

  const energyValues = metrics
    .map(getMetricEnergy)
    .filter((value) => typeof value === "number" && value > 0);

  const temperatureValues = metrics
    .map(getMetricTemperature)
    .filter((value): value is number => typeof value === "number");

  const energyBars = calculateBarHeights(energyValues);
  const temperatureBars = calculateBarHeights(temperatureValues);

  const dashboardCards = useMemo<StatCardItem[]>(
    () => [
      {
        icon: "flash-outline",
        title: "Total Energy",
        value: loading ? "--" : totalEnergy.toFixed(0),
        unit: "kW",
        badge: "Live",
      },
      {
        icon: "thermometer-outline",
        title: "Avg Temp",
        value: loading ? "--" : avgTemp.toFixed(1),
        unit: "°C",
        badge: "Live",
      },
      {
        icon: "person-outline",
        title: "Registered Users",
        value: loading ? "--" : String(registeredUsers),
        unit: "users",
        badge: "Live",
      },
      {
        icon: "warning-outline",
        title: "System Alerts",
        value: loading ? "--" : String(activeAlerts),
        unit: "Active",
        badge: activeAlerts > 0 ? "New" : "OK",
      },
    ],
    [loading, totalEnergy, avgTemp, registeredUsers, activeAlerts]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />

          <Text style={styles.logo}>LabControl 4.0</Text>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/Notifications" as any)}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#374151"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/UserProfileSettings" as any)}
              style={styles.avatarMini}
            >
              <Text style={styles.avatarLetter}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.greeting}>Olá, {userName}</Text>
        <Text style={styles.pageTitle}>Facility Overview</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {dashboardCards.map((item, index) => (
            <StatCard key={index} item={item} />
          ))}
        </View>

        <View style={styles.largeCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Energy Trends</Text>
              <Text style={styles.sectionSubtitle}>
                Consumption over last records
              </Text>
            </View>

            <Feather name="more-horizontal" size={18} color="#6B7280" />
          </View>

          <View style={styles.barChartRow}>
            {energyBars.map((height, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={[styles.energyBarTop, { height }]} />
                <View style={styles.energyBarBottom} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.largeCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Lab Temperature</Text>
              <Text style={styles.sectionSubtitle}>Zone distribution</Text>
            </View>

            <Text style={styles.normalText}>● Normal</Text>
          </View>

          <View style={styles.barChartRow}>
            {temperatureBars.map((height, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={[styles.barTop, { height }]} />
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
  avatarLetter: {
    fontSize: 11,
    fontWeight: "700",
  },
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
  loadingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#6B7280",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "600",
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
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
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
  energyBarTop: {
    width: 24,
    backgroundColor: "#BFDBFE",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  energyBarBottom: {
    width: 24,
    height: 20,
    backgroundColor: "#2563EB",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});