import React, { useCallback, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";

import { BottomNavBar } from "../../components/BottomNavBar";
import { getPlants } from "../../../lib/plants";
import type { Plant } from "../../../types/plant";

export default function LabsScreen() {
  const router = useRouter();

  const [labs, setLabs] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlants = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setLabs(await getPlants());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os laboratórios."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPlants();
    }, [loadPlants])
  );

  const openCreateScreen = () =>
    router.push("/(tabs)/Labs/create" as Href);

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

          <Text style={styles.title}>Labs</Text>

          <TouchableOpacity
            style={styles.createButton}
            onPress={openCreateScreen}
            accessibilityRole="button"
            accessibilityLabel="Criar laboratório"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Gerencie os laboratórios cadastrados na sua conta.
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.mapButton}
          activeOpacity={0.85}
          onPress={() => router.push("/PlantLocationsMap")}
        >
          <Ionicons name="map-outline" size={22} color="#2563EB" />
          <View style={styles.mapButtonCopy}>
            <Text style={styles.mapButtonTitle}>Mapa geográfico</Text>
            <Text style={styles.mapButtonSubtitle}>
              Registrar e consultar a localização das plantas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              Carregando laboratórios...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={42} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadPlants()}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {labs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="business-outline"
                  size={42}
                  color="#9CA3AF"
                />

                <Text style={styles.emptyTitle}>
                  Nenhum laboratório encontrado
                </Text>

                <Text style={styles.emptySubtitle}>
                  Você ainda não possui plantas cadastradas.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  onPress={openCreateScreen}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyCreateButtonText}>
                    Cadastrar laboratório
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              labs.map((lab) => (
                <TouchableOpacity
                  key={lab.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/InteractiveFloorPlanMap",
                      params: {
                        plantId: lab.id,
                        labName: lab.name,
                        plantDescription: lab.description,
                        scale: lab.scale.toString(),
                        widthUnits: lab.widthUnits.toString(),
                        heightUnits: lab.heightUnits.toString(),
                      },
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{lab.name}</Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#9CA3AF"
                    />
                  </View>

                  <Text style={styles.cardDetail}>
                    {lab.description}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <BottomNavBar activeTab="labs" />
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

  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#2563EB",
  },

  createButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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

  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  mapButtonCopy: {
    flex: 1,
  },

  mapButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  mapButtonSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },

  list: {
    gap: 12,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  cardDetail: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  emptyCreateButton: {
    marginTop: 18,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  emptyCreateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },

  retryButtonText: {
    color: "#1F2937",
    fontWeight: "700",
  },
});