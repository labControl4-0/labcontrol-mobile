import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { clearAuth } from "../../services/tokenStorage";

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await clearAuth();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Ionicons name="git-network-outline" size={32} color="#1de8df" />
        </View>
        <Text style={styles.title}>LabControll 4.0</Text>
        <Text style={styles.subtitle}>Você está autenticado</Text>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#18dcd3" />
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dfe8f4",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#0c1736",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#18233f",
  },
  subtitle: {
    fontSize: 15,
    color: "#7082a2",
  },
  logoutButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#0b1738",
  },
  logoutText: {
    color: "#f4f7ff",
    fontSize: 15,
    fontWeight: "600",
  },
});
