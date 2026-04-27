import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const stats = [
  { label: "Labs", value: "12" },
  { label: "Sessions", value: "84" },
  { label: "Uptime", value: "99%", highlight: true },
];

const accountSettings = [
  {
    icon: "account-outline",
    title: "Personal Information",
    subtitle: "Email, Phone, Department ID",
  },
  {
    icon: "shield-account-outline",
    title: "Permissions & Roles",
    subtitle: "Admin Access, Zone Control",
  },
];

const appPreferences = [
  {
    icon: "notifications-outline",
    title: "Notifications",
    subtitle: "Critical Alerts, Reports",
    badge: "2",
  },
  {
    icon: "language",
    title: "Language & Region",
    subtitle: "English (US), UTC-5",
  },
  {
    icon: "lock-outline",
    title: "Security",
    subtitle: "Biometrics, Password",
  },
];

function MenuCard({ item }: any) {
  return (
    <TouchableOpacity style={styles.menuCard} activeOpacity={0.8}>
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
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Profile & Settings</Text>

          <TouchableOpacity>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
              }}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.name}>Dr. Elena Rossi</Text>

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

        {/* Account Settings */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        {accountSettings.map((item, index) => (
          <MenuCard key={index} item={item} />
        ))}

        {/* App Preferences */}
        <Text style={styles.sectionTitle}>App Preferences</Text>
        {appPreferences.map((item, index) => (
          <MenuCard key={index} item={item} />
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Bottom Tab */}
        <View style={styles.bottomTab}>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="grid-outline" size={20} color="#9CA3AF" />
            <Text style={styles.tabText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="hardware-chip-outline" size={20} color="#9CA3AF" />
            <Text style={styles.tabText}>Devices</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.centerTab}>
            <MaterialCommunityIcons
              name="flask-outline"
              size={24}
              color="#2563EB"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="alert-circle-outline" size={20} color="#9CA3AF" />
            <Text style={styles.tabText}>Alerts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="person-outline" size={20} color="#2563EB" />
            <Text style={[styles.tabText, { color: "#2563EB" }]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: width * 0.018,
    fontWeight: "100",
    color: "#111827",
  },
  editText: {
    color: "#2563EB",
    fontWeight: "600",
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
    width: 90,
    height: 90,
    borderRadius: 45,
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
  bottomTab: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabItem: {
    alignItems: "center",
  },
  tabText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  centerTab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -30,
  },
});
