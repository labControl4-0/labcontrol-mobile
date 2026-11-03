import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useUnsyncedCount } from "../../lib/offline/useUnsyncedCount";

/** Atalho para a lista de ocorrências, com a quantidade ainda não enviada. */
export function PendingOccurrencesButton() {
  const router = useRouter();
  const { count } = useUnsyncedCount();

  return (
    <TouchableOpacity
      onPress={() => router.push("/Occurrences" as any)}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Ocorrências, ${count} não enviada(s)` : "Ocorrências"
      }
      hitSlop={10}
    >
      <Ionicons name="document-text-outline" size={22} color="#111827" />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#B45309",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
