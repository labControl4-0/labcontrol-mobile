// Lista de ocorrências do usuário com o estado real de envio de cada uma.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { BottomNavBar } from "../../components/BottomNavBar";
import { getAuthSession } from "../../../lib/auth";
import { SYNC_STATUS_UI, eventTypeLabel } from "../../../lib/offline/occurrenceForm";
import {
  listOccurrences,
  requeueConflict,
  requeueFailed,
  type Occurrence,
} from "../../../lib/offline/occurrenceRepository";
import {
  notifySyncChanged,
  subscribeToSync,
  syncPendingOccurrences,
  type SyncResult,
} from "../../../services/occurrenceSync";

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("pt-BR");
}

function syncMessage(result: SyncResult | null) {
  if (!result) return { type: "error", text1: "Sessão expirada", text2: "Faça login novamente." };
  if (result.stoppedBy === "network" || result.stoppedBy === "timeout") {
    return {
      type: "info",
      text1: "Sem conexão com o servidor",
      text2: `${result.remaining} ocorrência(s) continuam pendentes.`,
    };
  }
  if (result.stoppedBy === "backoff") {
    return {
      type: "info",
      text1: "Nova tentativa agendada",
      text2: `${result.remaining} ocorrência(s) aguardam o retry automático.`,
    };
  }
  if (result.conflicted > 0) {
    return {
      type: "info",
      text1: `${result.conflicted} conflito(s) para revisar`,
      text2: `${result.remaining} ocorrência(s) continuam na fila.`,
    };
  }
  if (result.stoppedBy) {
    return {
      type: "info",
      text1: "Envio interrompido",
      text2: `${result.remaining} ocorrência(s) continuam pendentes.`,
    };
  }
  if (result.sent === 0 && result.failed === 0 && result.conflicted === 0) {
    return { type: "info", text1: "Nada pendente para enviar" };
  }
  return {
    type: result.failed > 0 ? "error" : "success",
    text1: `${result.sent} enviada(s)`,
    text2: result.failed > 0 ? `${result.failed} recusada(s) ou sem retry automático.` : undefined,
  };
}

function OccurrenceCard({
  item,
  onRetry,
  onResolveConflict,
}: {
  item: Occurrence;
  onRetry: (id: string) => void;
  onResolveConflict: (id: string) => void;
}) {
  const status = SYNC_STATUS_UI[item.syncStatus];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.machineName}</Text>
        <Text style={styles.cardType}>{eventTypeLabel(item.eventType)}</Text>
      </View>

      <Text style={styles.cardSector}>Setor: {item.sectorName ?? item.sectorId}</Text>
      <Text style={styles.cardDescription}>{item.description}</Text>
      <Text style={styles.cardMeta}>Ocorrido em {formatDate(item.occurredAt)}</Text>

      <View style={[styles.status, { backgroundColor: `${status.color}14` }]}>
        <Ionicons name={status.icon as any} size={15} color={status.color} />
        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
      </View>

      {item.syncStatus !== "synced" && item.lastError ? (
        <Text style={styles.cardError}>Último erro: {item.lastError}</Text>
      ) : null}

      {item.syncStatus === "failed" ? (
        <TouchableOpacity onPress={() => onRetry(item.id)} accessibilityRole="button">
          <Text style={styles.retry}>Tentar enviar de novo</Text>
        </TouchableOpacity>
      ) : null}

      {item.syncStatus === "conflict" ? (
        <View>
          <Text style={styles.conflictHelp}>
            Nada foi sobrescrito. Revise o erro antes de pedir novo envio.
          </Text>
          <TouchableOpacity
            onPress={() => onResolveConflict(item.id)}
            accessibilityRole="button"
          >
            <Text style={styles.retry}>Reenviar após revisar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.cardId}>Ref.: {item.id}</Text>
    </View>
  );
}

export default function OccurrencesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const session = await getAuthSession();
    const userId = session?.user.id;
    if (!userId) {
      router.replace("/");
      return;
    }
    setItems(await listOccurrences(userId));
    setLoading(false);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  useEffect(() => subscribeToSync(() => load().catch(() => undefined)), [load]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingOccurrences({ force: true });
      Toast.show(syncMessage(result) as any);
    } finally {
      setSyncing(false);
      await load().catch(() => undefined);
    }
  };

  const handleRetry = async (id: string) => {
    const session = await getAuthSession();
    if (!session?.user.id) return;
    await requeueFailed(session.user.id, id);
    notifySyncChanged();
    await handleSyncNow();
  };

  const handleResolveConflict = async (id: string) => {
    const session = await getAuthSession();
    if (!session?.user.id) return;
    await requeueConflict(session.user.id, id);
    notifySyncChanged();
    await handleSyncNow();
  };

  const unsynced = items.filter((i) => i.syncStatus !== "synced").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Ocorrências</Text>
        <TouchableOpacity
          onPress={() => router.push("/Devices")}
          accessibilityLabel="Nova ocorrência: escolher máquina"
        >
          <Ionicons name="add" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {unsynced > 0
            ? `${unsynced} ocorrência(s) ainda não enviada(s) ao servidor.`
            : "Todas as ocorrências foram enviadas."}
        </Text>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={handleSyncNow}
          disabled={syncing}
          accessibilityRole="button"
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>Sincronizar agora</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#2563EB" size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <OccurrenceCard
              item={item}
              onRetry={handleRetry}
              onResolveConflict={handleResolveConflict}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Nenhuma ocorrência registrada. Toque em + e escolha uma máquina.
            </Text>
          }
        />
      )}

      <BottomNavBar activeTab="devices" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 14,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  summary: {
    marginHorizontal: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  syncButton: {
    backgroundColor: "#0B1738",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  loader: { marginTop: 32 },
  list: { paddingHorizontal: 22, paddingBottom: 132, gap: 10 },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 14 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flexShrink: 1 },
  cardType: { fontSize: 12, fontWeight: "700", color: "#1E3A8A" },
  cardSector: { fontSize: 12, color: "#6B7280" },
  cardDescription: { fontSize: 13, color: "#111827", lineHeight: 18 },
  cardMeta: { fontSize: 11, color: "#6B7280" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  cardError: { fontSize: 11, color: "#B91C1C" },
  conflictHelp: { fontSize: 11, color: "#9A3412", lineHeight: 16 },
  retry: { fontSize: 12, fontWeight: "700", color: "#2563EB", marginTop: 2 },
  cardId: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
});
