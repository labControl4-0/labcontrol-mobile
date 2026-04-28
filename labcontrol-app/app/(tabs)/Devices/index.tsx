import React from "react";
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

const devices = [
  { name: "Air Handling Unit", status: "Online", detail: "Zone 1 airflow stabilized" },
  { name: "Cooling Module 04", status: "Maintenance", detail: "Inspection due in 2 hours" },
  { name: "Sterile Chamber", status: "Online", detail: "Temperature steady at 21.8°C" },
];

export default function DevicesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/Dashboard")}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Devices</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>Active equipment and machine health for the facility.</Text>

        <View style={styles.list}>
          {devices.map((item) => (
            <View key={item.name} style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardStatus}>{item.status}</Text>
              <Text style={styles.cardDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      <BottomNavBar activeTab="devices" />
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