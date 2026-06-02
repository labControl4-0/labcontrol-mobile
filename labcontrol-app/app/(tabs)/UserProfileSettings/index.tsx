// ProfileSettingsScreen.tsx - ATUALIZADO (apenas as partes modificadas)
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
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
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";
import {
  logout,
  getAuthSession,
  getAuthToken,
  saveAuthSession,
} from "../../../lib/auth";
import { updateUser, updateUserPhoto } from "../../../lib/users";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MenuCard = ({ item, onPress }: { item: any; onPress: () => void }) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress}>
    <Feather name={item.icon as any} size={20} color="#6B7280" />
    <Text style={styles.menuLabel}>{item.label}</Text>
    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
  </TouchableOpacity>
);

const PROFILE_IMAGE_KEY = "profile_image_uri";

const stats = [
  { value: "0", label: "Credits" },
  { value: "0", label: "Bookings" },
  { value: "0", label: "Reviews" },
];

const appPreferences = [
  { icon: "bell", label: "Notifications", route: "/Notifications" },
  { icon: "lock", label: "Privacy", route: "/Privacy" },
  { icon: "help-circle", label: "Help & Support", route: "/Help" },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();

  const [profileName, setProfileName] = useState("");
  const [tempName, setTempName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingName, setSavingName] = useState(false);    // NOVO
  const [savingPhoto, setSavingPhoto] = useState(false);  // NOVO

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const session = await getAuthSession();

    if (!session) {
      router.replace("/");
      return;
    }

    setProfileName(session.name);
    setTempName(session.name);
    setEmail(session.email);

    // NOVO: Carrega foto salva localmente
    try {
      const savedImage = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
      if (savedImage) setProfileImage(savedImage);
    } catch (_) {}
  };

  // CORRIGIDO: Salva nome com loading e feedback adequado
  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Toast.show({ type: "error", text1: "Nome inválido" });
      return;
    }

    setSavingName(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        Toast.show({ type: "error", text1: "Sessão expirada, faça login novamente" });
        return;
      }

      await updateUser(token, { name: tempName.trim() });

      const session = await getAuthSession();
      if (session) {
        await saveAuthSession({ ...session, name: tempName.trim() });
      }

      setProfileName(tempName.trim());
      setEditModalVisible(false);

      Toast.show({ type: "success", text1: "Nome atualizado com sucesso" });
    } catch (error: any) {
      console.error("handleSaveName error:", error);
      Toast.show({
        type: "error",
        text1: "Erro ao atualizar nome",
        text2: error?.message ?? "Tente novamente",
      });
    } finally {
      setSavingName(false);
    }
  };

  // CORRIGIDO: Logout com limpeza completa e navegação segura
  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (_) {
            // Garante navegação mesmo se logout falhar
          } finally {
            // Usa replace para limpar o stack de navegação completamente
            router.replace("/");
            setTimeout(() => {
              Toast.show({ type: "success", text1: "Logout realizado com sucesso" });
            }, 500);
          }
        },
      },
    ]);
  };

  const handleMenuPress = (item: any) => {
    if (item.route === "/Notifications") {
      router.push({
        pathname: "/Notifications",
        params: { from: "profile" },
      } as any);
    }
  };

  // CORRIGIDO: Persiste foto localmente + tenta enviar à API
  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Permissão negada",
        text2: "Permita o acesso à galeria nas configurações",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Comprime para upload mais rápido
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    setSavingPhoto(true);
    try {
      // 1. Salva localmente PRIMEIRO (garante UX mesmo se API falhar)
      await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
      setProfileImage(uri);

      // 2. Tenta enviar à API (se sua API suportar upload de foto)
      const token = await getAuthToken();
      if (token) {
        try {
          await updateUserPhoto(token, uri);
          Toast.show({ type: "success", text1: "Foto atualizada!" });
        } catch (_) {
          // API falhou mas foto foi salva localmente
          Toast.show({
            type: "info",
            text1: "Foto salva localmente",
            text2: "Não foi possível sincronizar com o servidor",
          });
        }
      }
    } catch (error) {
      Toast.show({ type: "error", text1: "Erro ao salvar foto" });
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* HEADER - sem alteração */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(true)}>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE - avatar com indicador de loading */}
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
            {/* Overlay de loading sobre a foto existente */}
            {savingPhoto && profileImage && (
              <View style={[styles.avatarPlaceholder, {
                position: "absolute", backgroundColor: "rgba(0,0,0,0.3)"
              }]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.name}>{profileName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* STATS, MENU, LOGOUT - sem alteração */}
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.value}>{s.value}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>App Preferences</Text>
        {appPreferences.map((item, i) => (
          <MenuCard key={i} item={item} onPress={() => handleMenuPress(item)} />
        ))}

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavBar activeTab="profile" />
      <Toast />

      {/* MODAL - botão Save com loading */}
      <Modal visible={editModalVisible} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setTempName(profileName); // Reseta ao cancelar
                setEditModalVisible(false);
              }}
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
              <Text>Email</Text>
              <Text>{email}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  edit: {
    color: "#2563EB",
  },
  profile: {
    alignItems: "center",
    marginVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  name: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
  },
  email: {
    color: "#6B7280",
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  card: {
    alignItems: "center",
    flex: 1,
  },
  value: {
    fontWeight: "700",
  },
  label: {
    color: "#6B7280",
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
    fontWeight: "700",
  },
  logout: {
    marginTop: 20,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  logoutText: {
    color: "#B91C1C",
    fontWeight: "600",
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 8,
  },
  infoBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
});