import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomNavBar } from "../../components/BottomNavBar";

const { width } = Dimensions.get("window");

const stats = [
  { label: "Labs", value: "12" },
  { label: "Sessions", value: "84" },
  { label: "Uptime", value: "99%", highlight: true },
];

const appPreferences = [
  {
    icon: "notifications-outline",
    title: "Notifications",
    subtitle: "Critical Alerts, Reports",
    badge: "2",
    route: "/(tabs)/Notifications",
  },
  {
    icon: "language",
    title: "Language & Region",
    subtitle: "English (US), UTC-5",
  },
];

function MenuCard({ item, onPress }: any) {
  return (
    <TouchableOpacity
      style={styles.menuCard}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.menuLeft}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color="#3B82F6"
          />
        </View>

        <View>
          <Text style={styles.menuTitle}>{item.title}</Text>
          <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
        </View>
      </View>

      <View style={styles.menuRight}>
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const [profileName, setProfileName] = useState("Dr. Elena Rossi");
  const [tempName, setTempName] = useState(profileName);
  const [profileImage, setProfileImage] = useState(
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330"
  );
  const [editModalVisible, setEditModalVisible] = useState(false);

  const handleSaveName = () => {
    if (tempName.trim()) {
      setProfileName(tempName);
      setEditModalVisible(false);
      Alert.alert("Success", "Profile name updated successfully!");
    } else {
      Alert.alert("Error", "Name cannot be empty");
    }
  };

  const handleChangePhoto = () => {
    Alert.alert("Change Photo", "Integrate image picker library here");
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Do you want to unlink this account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => router.replace("/"),
      },
    ]);
  };

  const handleMenuPress = (item: any) => {
    if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/Dashboard")}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Profile & Settings</Text>

          <TouchableOpacity onPress={() => setEditModalVisible(true)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri: profileImage,
              }}
              style={styles.avatar}
              resizeMode="contain"
            />
            <TouchableOpacity 
              style={styles.editAvatarButton}
              onPress={handleChangePhoto}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.name}>{profileName}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>SYSTEM ADMINISTRATOR</Text>
          </View>

          <Text style={styles.companyText}>
            LabControl AI • Enterprise Edition
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((item, index) => (
            <View key={index} style={styles.statCard}>
              <Text
                style={[
                  styles.statValue,
                  item.highlight && { color: "#16A34A" },
                ]}
              >
                {item.value}
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* App Preferences */}
        <Text style={styles.sectionTitle}>App Preferences</Text>
        {appPreferences.map((item, index) => (
          <MenuCard
            key={index}
            item={item}
            onPress={item.route ? () => handleMenuPress(item) : undefined}
          />
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      <BottomNavBar activeTab="profile" />

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveName}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Edit Photo Section */}
            <View style={styles.editPhotoSection}>
              <Text style={styles.modalLabel}>Profile Photo</Text>
              <TouchableOpacity 
                style={styles.photoEditButton}
                onPress={handleChangePhoto}
              >
                <Image
                  source={{ uri: profileImage }}
                  style={styles.photoPreview}
                  resizeMode="contain"
                />
                <View style={styles.photoOverlay}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to change photo</Text>
            </View>

            {/* Edit Name Section */}
            <View style={styles.editNameSection}>
              <Text style={styles.modalLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter your name"
                value={tempName}
                onChangeText={setTempName}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Account Information</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>elena.rossi@labcontrol.com</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>System Administrator</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Account Type</Text>
                <Text style={styles.infoValue}>Enterprise Edition</Text>
              </View>
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
    backgroundColor: "#F5F7FB",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 132,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  editText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 14,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 45,
    backgroundColor: "#fff",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    position: "absolute",
    bottom: 4,
    right: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  roleBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 11,
  },
  companyText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  menuTitle: {
    fontWeight: "600",
    fontSize: 14,
    color: "#111827",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  logoutButton: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3DADA",
  },
  logoutText: {
    color: "#DC2626",
    fontWeight: "600",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  modalCancel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalSave: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  editPhotoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  photoEditButton: {
    position: "relative",
    marginBottom: 12,
  },
  photoPreview: {
    width: 112,
    height: 112,
    borderRadius: 50,
    backgroundColor: "#fff",
  },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoHint: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  editNameSection: {
    marginBottom: 32,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  infoSection: {
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
});
