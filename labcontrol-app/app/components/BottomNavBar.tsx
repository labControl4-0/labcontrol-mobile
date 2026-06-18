import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface BottomNavBarProps {
  activeTab?: "dashboard" | "devices" | "labs" | "chat" | "notifications" | "profile";
}

export function BottomNavBar({ activeTab = "dashboard" }: BottomNavBarProps) {
  const router = useRouter();

  const tabs = [
    { id: "dashboard", icon: "grid", route: "/Dashboard" },
    { id: "devices", icon: "map-outline", route: "/Devices" },
    { id: "labs", icon: "flash-outline", route: "/Labs" },
    { id: "chat", icon: "chatbubble-ellipses-outline", route: "/Chat" },
    { id: "notifications", icon: "notifications-outline", route: "/Notifications" },
    { id: "profile", icon: "person-outline", route: "/UserProfileSettings" },
  ];

  return (
    <View style={styles.bottomTab}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => router.push(tab.route as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={isActive ? "#2563EB" : "#9CA3AF"}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTab: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 16,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 11,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  tabItem: {
    alignItems: "center",
  },
});
