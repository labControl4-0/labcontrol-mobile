import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function formatCachedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "data desconhecida";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Aviso de que os dados exibidos são a cópia salva no aparelho. */
export function OfflineBanner({
  cachedAt,
  onRetry,
}: {
  cachedAt: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.banner} accessibilityRole="summary" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
      <Text style={styles.text}>
        Parte do catálogo veio da cópia salva no dispositivo em {formatCachedAt(cachedAt)}.
      </Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Tentar atualizar o catálogo">
          <Text style={styles.retry}>Tentar de novo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },
  retry: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
});
