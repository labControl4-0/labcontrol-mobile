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
import { ApiError } from "../../../services/api";
import {
  getMachinesByPlantCached,
  getPlantsCached,
  getSectorsByPlantCached,
} from "../../../services/catalogService";
import { OfflineBanner } from "../../components/OfflineBanner";
import { PendingOccurrencesButton } from "../../components/PendingOccurrencesButton";

type MachineStatus = "active" | "warning" | "error" | "idle";

type Machine = {
  id: string;
  plantId: string;
  sectorId: string;
  name: string;
  model: string;
  status: MachineStatus;
  posX: number;
  posY: number;
  createdAt: string;
  updatedAt: string;
};

type Plant = {
  id: string;
  name: string;
};

type PlantGroup = {
  plant: Plant;
  machines: Machine[];
  /** Nome de cada setor, pelo id. Pode faltar se os setores não carregarem. */
  sectorNames: Record<string, string>;
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

function MachineCard({
  machine,
  onPress,
}: {
  machine: Machine;
  onPress: () => void;
}) {
  const status = machine.status;
  const color = STATUS_COLOR[status] ?? "#9CA3AF";
  const label = STATUS_LABEL[status] ?? "Desconhecido";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Registrar ocorrência em ${machine.name}`}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{machine.name}</Text>
        <Text style={styles.cardModel}>{machine.model}</Text>
      </View>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: `${color}18`,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>

      <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
    </TouchableOpacity>
  );
}

export default function MachinesScreen() {
  const router = useRouter();

  const [groups, setGroups] = useState<PlantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Data da cópia offline mais antiga exibida; null quando tudo veio da API.
  const [offlineSince, setOfflineSince] = useState<string | null>(null);

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      const cachedDates: string[] = [];
      const track = <T,>(r: { data: T; source: string; cachedAt?: string }) => {
        if (r.source === "cache" && r.cachedAt) cachedDates.push(r.cachedAt);
        return r.data;
      };

      const plants = track(await getPlantsCached()) as Plant[];

      const groupsData = await Promise.all(
        plants.map(async (plant): Promise<PlantGroup> => {
          let machines: Machine[] = [];
          let sectorNames: Record<string, string> = {};

          try {
            machines = track(await getMachinesByPlantCached(plant.id)) as Machine[];
          } catch (err) {
            if (err instanceof ApiError && err.code === "unauthorized") throw err;
            console.warn(`Máquinas do lab ${plant.name} indisponíveis.`);
          }

          try {
            const sectors = track(await getSectorsByPlantCached(plant.id));
            sectorNames = Object.fromEntries(sectors.map((s) => [s.id, s.name]));
          } catch (err) {
            if (err instanceof ApiError && err.code === "unauthorized") throw err;
            // Sem nome do setor, o formulário mostra só o id.
          }

          return { plant, machines, sectorNames };
        })
      );

      setGroups(groupsData);
      setOfflineSince(cachedDates.length > 0 ? cachedDates.sort()[0] : null);
    } catch (err) {
      // Em 401 o api.ts já limpou a sessão e redirecionou para o login.
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as máquinas."
      );
    } finally {
      setLoading(false);
    }
  };

  const totalMachines = groups.reduce(
    (acc, group) => acc + group.machines.length,
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/Dashboard")}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />
          </TouchableOpacity>

          <Text style={styles.title}>Máquinas</Text>

          <PendingOccurrencesButton />
        </View>

        {offlineSince && !loading ? (
          <OfflineBanner cachedAt={offlineSince} onRetry={loadMachines} />
        ) : null}

        <Text style={styles.subtitle}>
          {loading
            ? "Carregando..."
            : error
            ? ""
            : `${totalMachines} máquina(s) em ${groups.length} lab(s). Toque numa máquina para registrar uma ocorrência.`}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#2563EB"
            style={{ marginTop: 32 }}
          />
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color="#9CA3AF"
            />

            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="hardware-chip-outline"
              size={40}
              color="#9CA3AF"
            />

            <Text style={styles.errorText}>
              Nenhum laboratório cadastrado.
            </Text>
          </View>
        ) : (
          groups.map(({ plant, machines, sectorNames }) => (
            <View key={plant.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="business-outline"
                  size={15}
                  color="#6B7280"
                />

                <Text style={styles.sectionTitle}>
                  {plant.name}
                </Text>
              </View>

              {machines.length === 0 ? (
                <Text style={styles.empty}>
                  Nenhuma máquina neste laboratório.
                </Text>
              ) : (
                <View style={styles.list}>
                  {machines.map((machine) => (
                    <MachineCard
                      key={machine.id}
                      machine={machine}
                      onPress={() =>
                        router.push({
                          pathname: "/NewOccurrence",
                          params: {
                            machineId: machine.id,
                            machineName: machine.name,
                            sectorId: machine.sectorId ?? "",
                            sectorName: sectorNames[machine.sectorId] ?? "",
                          },
                        } as any)
                      }
                    />
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 16,
  },

  section: {
    marginBottom: 24,
  },

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

  list: {
    gap: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
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

  cardBody: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  cardModel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  empty: {
    fontSize: 13,
    color: "#9CA3AF",
    paddingLeft: 4,
  },

  errorBox: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    gap: 12,
  },

  errorText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
});