import React from "react";
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

const labs = [
  { name: "Lab A1", status: "Temperature stable", detail: "21.7°C and 42% humidity" },
  { name: "Lab B2", status: "Alert monitored", detail: "CO2 spike cleared automatically" },
  { name: "Lab C3", status: "Normal", detail: "All devices reporting healthy" },
];

export default function LabsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/Dashboard")}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Labs</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>Temperature, humidity, and operating status across all labs.</Text>

        <View style={styles.list}>
          {labs.map((item) => (
            <View key={item.name} style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardStatus}>{item.status}</Text>
              <Text style={styles.cardDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      <BottomNavBar activeTab="labs" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollContent: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 132 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerSpacer: { width: 22 },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 16 },
  list: { gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardStatus: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#2563EB" },
  cardDetail: { marginTop: 4, fontSize: 12, color: "#6B7280" },
});