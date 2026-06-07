import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { BottomNavBar } from "../../components/BottomNavBar";
import { getPlants } from "../../../lib/plants";
import type { Plant } from "../../../types/plant";

export default function LabsScreen() {
  const router = useRouter();

  const [labs, setLabs] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlants = useCallback(async () => {
    try {
      setLoading(true);

      const plants = await getPlants();

      setLabs(plants);
    } catch (error) {
      console.error(error);

      Toast.show({
        type: "error",
        text1: "Erro ao carregar laboratórios",
        text2: "Não foi possível buscar os dados.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

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

          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          Temperature, humidity, and operating status across all labs.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              Carregando laboratórios...
            </Text>
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

                  <Text style={styles.cardStatus}>
                    Escala: {lab.scale}
                  </Text>

                  <Text style={styles.cardDetail}>
                    {lab.description}
                  </Text>

                  <Text style={styles.cardMeta}>
                    {lab.widthUnits} x {lab.heightUnits} unidades
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

  headerSpacer: {
    width: 22,
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

  cardStatus: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  cardDetail: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  cardMeta: {
    marginTop: 8,
    fontSize: 11,
    color: "#9CA3AF",
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
});