import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import {
  getAuthSession,
  getAuthToken,
  saveAuthSession,
  clearAuthSession,
} from "../../../lib/auth";
import { clearAuth, getToken, getUser } from "../../../services/tokenStorage";
import { apiFetchAuth } from "../../../services/api";
import { updateUserPhoto } from "../../../lib/users";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_IMAGE_KEY = "profile_image_uri";
const WHATSAPP_NUMBER = "5511999422998";
const WHATSAPP_MESSAGE =
  "Olá! Estou usando o *LabControl 4.0* — plataforma de monitoramento industrial de laboratórios — e preciso de suporte.\n\n" +
  "📱 *App:* LabControl Mobile\n" +
  "🏭 *Função:* Monitoramento de máquinas, setores e labs em tempo real\n" +
  "🔧 *Recursos:* Blueprint interativo, status de equipamentos, métricas e alertas\n\n" +
  "Por favor, me ajude com a seguinte situação:";

const appPreferences = [
  { icon: "bell", label: "Notifications", key: "notifications" },
  { icon: "help-circle", label: "Help & Support", key: "help" },
];

const MenuCard = ({ item, onPress }: { item: any; onPress: () => void }) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress}>
    <Feather name={item.icon as any} size={20} color="#6B7280" />
    <Text style={styles.menuLabel}>{item.label}</Text>
    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
  </TouchableOpacity>
);

export default function ProfileSettingsScreen() {
  const router = useRouter();

  const [profileName, setProfileName] = useState("");
  const [tempName, setTempName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    // Tenta localStorage (web) primeiro, depois AsyncStorage (mobile)
    let s: any = getAuthSession();
    if (!s) {
      const [token, user] = await Promise.all([getToken(), getUser()]);
      if (!token && !user) {
        router.replace("/");
        return;
      }
      s = { ...(user ?? {}), token };
    }
    const name = s.user?.name ?? s.name ?? "";
    const emailVal = s.user?.email ?? s.email ?? "";
    setProfileName(name);
    setTempName(name);
    setEmail(emailVal);
    try {
      const savedImage = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
      if (savedImage) setProfileImage(savedImage);
    } catch (_) {}
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Toast.show({ type: "error", text1: "Nome inválido" });
      return;
    }
    setSavingName(true);
    try {
      // Tenta localStorage (web) primeiro, depois AsyncStorage (mobile)
      let session: any = getAuthSession();
      if (!session) {
        const user = await getUser();
        session = user ?? {};
      }
      const userId = session?.id ?? session?.user?.id;

      if (!userId) {
        Toast.show({ type: "error", text1: "Sessão expirada, faça login novamente" });
        return;
      }

      await apiFetchAuth(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ name: tempName.trim() }),
      });

      await saveAuthSession({ ...session, name: tempName.trim() } as any);
      setProfileName(tempName.trim());
      Toast.show({ type: "success", text1: "Nome atualizado com sucesso" });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Erro ao atualizar nome",
        text2: error?.message ?? "Tente novamente",
      });
    } finally {
      setSavingName(false);
      setEditModalVisible(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await clearAuth();
            clearAuthSession();
          } catch (_) {}
          if (Platform.OS === "web") {
            window.location.replace("/");
          } else {
            router.replace("/");
          }
        },
      },
    ]);
  };

  const handleMenuPress = (key: string) => {
    if (key === "notifications") {
      router.push({ pathname: "/Notifications", params: { from: "profile" } } as any);
    } else if (key === "help") {
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
      Linking.openURL(url).catch(() =>
        Toast.show({ type: "error", text1: "Não foi possível abrir o WhatsApp" })
      );
    }
  };

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Permissão negada", text2: "Permita o acesso à galeria" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setSavingPhoto(true);
    try {
      await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
      setProfileImage(uri);
      const token = await getAuthToken();
      if (token) {
        try {
          await updateUserPhoto(token, uri);
          Toast.show({ type: "success", text1: "Foto atualizada!" });
        } catch (_) {
          Toast.show({ type: "info", text1: "Foto salva localmente", text2: "Não foi possível sincronizar com o servidor" });
        }
      }
    } catch {
      Toast.show({ type: "error", text1: "Erro ao salvar foto" });
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profile}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={savingPhoto}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                {savingPhoto ? (
                  <ActivityIndicator color="#3B82F6" />
                ) : (
                  <Ionicons name="person" size={40} color="#9CA3AF" />
                )}
              </View>
            )}
            {savingPhoto && profileImage && (
              <View style={[styles.avatarPlaceholder, styles.avatarOverlay]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{profileName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <Text style={styles.section}>App Preferences</Text>
        {appPreferences.map((item) => (
          <MenuCard key={item.key} item={item} onPress={() => handleMenuPress(item.key)} />
        ))}

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavBar activeTab="profile" />
      <Toast />

      <Modal visible={editModalVisible} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => { setTempName(profileName); setEditModalVisible(false); }}
              disabled={savingName}
            >
              <Text style={{ color: savingName ? "#9CA3AF" : "#111827" }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "700" }}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
              {savingName ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text style={{ color: "#2563EB" }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={tempName}
              onChangeText={setTempName}
              style={styles.input}
              editable={!savingName}
              autoFocus
            />
            <View style={styles.infoBox}>
              <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>Email</Text>
              <Text>{email}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 20, paddingBottom: 120 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: "700" },
  editLink: { color: "#2563EB" },
  profile: { alignItems: "center", marginVertical: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  avatarOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  name: { marginTop: 10, fontSize: 18, fontWeight: "600" },
  email: { color: "#6B7280" },
  section: { marginTop: 20, marginBottom: 10, fontWeight: "700" },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuLabel: { flex: 1, marginLeft: 12, fontSize: 16 },
  logout: {
    marginTop: 28,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  logoutText: { color: "#B91C1C", fontWeight: "700", fontSize: 15 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputLabel: { fontSize: 12, color: "#6B7280", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  infoBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
});
