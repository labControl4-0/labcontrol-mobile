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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import { apiFetchAuth } from "../../../services/api";

type MachineStatus = "active" | "warning" | "error" | "idle";

type Machine = {
  id: string;
  name: string;
  model: string;
  status: MachineStatus;
  createdAt: string;
};

type PlantGroup = {
  plant: { id: string; name: string };
  machines: Machine[];
};

const STATUS_LABEL: Record<MachineStatus, string> = {
  active: "Ativo",
  warning: "Atenção",
  error: "Erro",
  idle: "Inativo",
};

const STATUS_COLOR: Record<MachineStatus, string> = {
  active: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  idle: "#9CA3AF",
};

function MachineCard({ machine }: { machine: Machine }) {
  const status = machine.status as MachineStatus;
  const color = STATUS_COLOR[status] ?? "#9CA3AF";
  const label = STATUS_LABEL[status] ?? machine.status;

  return (
    <View style={styles.card}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{machine.name}</Text>
        <Text style={styles.cardModel}>{machine.model}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

export default function MachinesScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<PlantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const plants: any[] = await apiFetchAuth("/plants");
        const result = await Promise.all(
          plants.map(async (p) => ({
            plant: p,
            machines: (await apiFetchAuth(`/machines/plant/${p.id}`)) as Machine[],
          }))
        );
        setGroups(result);
      } catch (e: any) {
        const isOffline = e?.message?.includes("fetch") || e?.message?.includes("network");
        setError(isOffline ? "Servidor indisponível. Verifique a conexão." : "Não foi possível carregar as máquinas.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalMachines = groups.reduce((acc, g) => acc + g.machines.length, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/Dashboard")}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Máquinas</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          {loading
            ? "Carregando..."
            : error
            ? ""
            : `${totalMachines} máquina(s) em ${groups.length} lab(s)`}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={40} color="#9CA3AF" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.errorBox}>
            <Ionicons name="hardware-chip-outline" size={40} color="#9CA3AF" />
            <Text style={styles.errorText}>Nenhum lab cadastrado ainda.</Text>
          </View>
        ) : (
          groups.map(({ plant, machines }) => (
            <View key={plant.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="business-outline" size={15} color="#6B7280" />
                <Text style={styles.sectionTitle}>{plant.name}</Text>
              </View>
              {machines.length === 0 ? (
                <Text style={styles.empty}>Nenhuma máquina neste lab.</Text>
              ) : (
                <View style={styles.list}>
                  {machines.map((m) => (
                    <MachineCard key={m.id} machine={m} />
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <BottomNavBar activeTab="devices" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollContent: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 132 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerSpacer: { width: 22 },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  list: { gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardModel: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: { fontSize: 13, color: "#9CA3AF", paddingLeft: 4 },
  errorBox: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  errorText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },
});
