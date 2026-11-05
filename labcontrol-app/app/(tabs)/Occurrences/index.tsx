// Lista de ocorrências do usuário com o estado real de envio de cada uma.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  requeueFailed,
  resolveConflictKeepBoth,
  resolveConflictKeepServer,
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
  if (result.stoppedBy) {
    return {
      type: "info",
      text1: "Envio interrompido",
      text2: `${result.remaining} ocorrência(s) continuam pendentes.`,
    };
  }
  const confirmed = result.sent + result.recovered;
  if (confirmed === 0 && result.failed === 0 && result.conflicts === 0) {
    return { type: "info", text1: "Nada pendente para enviar" };
  }
  const problems = [
    result.failed > 0 ? `${result.failed} recusada(s) pelo servidor` : null,
    result.conflicts > 0 ? `${result.conflicts} em conflito` : null,
  ].filter(Boolean);
  return {
    type: problems.length > 0 ? "error" : "success",
    text1: `${confirmed} confirmada(s) no servidor`,
    text2: problems.length > 0 ? `${problems.join(", ")}.` : undefined,
  };
}

type CardActions = {
  onRetry: (id: string) => void;
  onEdit: (item: Occurrence) => void;
  onKeepServer: (item: Occurrence) => void;
  onKeepBoth: (item: Occurrence) => void;
};

/** Mostra lado a lado o que está no aparelho e o que está no servidor. */
function ConflictPanel({ item, actions }: { item: Occurrence; actions: CardActions }) {
  const server = item.conflict?.server;

  return (
    <View style={styles.conflict}>
      <Text style={styles.conflictTitle}>O servidor tem outra versão desta ocorrência</Text>

      <Text style={styles.conflictLabel}>NO APARELHO</Text>
      <Text style={styles.conflictText}>
        {eventTypeLabel(item.eventType)}: {item.description}
      </Text>

      <Text style={styles.conflictLabel}>NO SERVIDOR</Text>
      <Text style={styles.conflictText}>
        {server
          ? `${server.eventType ? eventTypeLabel(server.eventType) : "?"}: ${server.description ?? "—"}`
          : "O servidor não informou a versão dele."}
      </Text>

      <View style={styles.conflictActions}>
        <TouchableOpacity
          style={styles.conflictButton}
          onPress={() => actions.onKeepServer(item)}
          accessibilityRole="button"
        >
          <Text style={styles.conflictButtonText}>Manter a do servidor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.conflictButton, styles.conflictButtonPrimary]}
          onPress={() => actions.onKeepBoth(item)}
          accessibilityRole="button"
        >
          <Text style={[styles.conflictButtonText, styles.conflictButtonTextPrimary]}>
            Enviar a minha como nova
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OccurrenceCard({ item, actions }: { item: Occurrence; actions: CardActions }) {
  const status = SYNC_STATUS_UI[item.syncStatus];
  const canEdit = item.syncStatus === "pending" || item.syncStatus === "failed";

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

      {item.syncStatus === "pending" && item.retryCount > 0 ? (
        <Text style={styles.cardMeta}>
          {item.retryCount} tentativa(s) sem sucesso.
          {item.nextAttemptAt ? ` Próxima automática após ${formatDate(new Date(item.nextAttemptAt).toISOString())}.` : ""}
        </Text>
      ) : null}

      {item.syncStatus === "conflict" ? <ConflictPanel item={item} actions={actions} /> : null}

      <View style={styles.cardActions}>
        {item.syncStatus === "failed" ? (
          <TouchableOpacity onPress={() => actions.onRetry(item.id)} accessibilityRole="button">
            <Text style={styles.retry}>Tentar enviar de novo</Text>
          </TouchableOpacity>
        ) : null}
        {canEdit ? (
          <TouchableOpacity onPress={() => actions.onEdit(item)} accessibilityRole="button">
            <Text style={styles.retry}>Editar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
      const result = await syncPendingOccurrences({ trigger: "manual" });
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

  const actions: CardActions = {
    onRetry: handleRetry,
    onEdit: (item) =>
      router.push({
        pathname: "/NewOccurrence",
        params: {
          occurrenceId: item.id,
          machineId: item.machineId,
          machineName: item.machineName,
          sectorId: item.sectorId,
          sectorName: item.sectorName ?? "",
        },
      } as any),
    onKeepServer: (item) =>
      Alert.alert(
        "Manter a versão do servidor?",
        "A sua edição feita no aparelho será descartada. A ocorrência do servidor continua como está.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Manter a do servidor",
            style: "destructive",
            onPress: async () => {
              const session = await getAuthSession();
              if (session?.user.id) await resolveConflictKeepServer(session.user.id, item.id);
              notifySyncChanged();
              Toast.show({ type: "success", text1: "Conflito resolvido", text2: "Mantida a versão do servidor." });
            },
          },
        ]
      ),
    onKeepBoth: (item) =>
      Alert.alert(
        "Enviar a sua versão como nova?",
        "O servidor fica com as duas ocorrências: a que já estava lá e a sua versão, como um registro novo.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Enviar como nova",
            onPress: async () => {
              const session = await getAuthSession();
              if (session?.user.id) await resolveConflictKeepBoth(session.user.id, item.id);
              notifySyncChanged();
              await handleSyncNow();
            },
          },
        ]
      ),
  };

  const unsynced = items.filter((i) => i.syncStatus !== "synced").length;
  const conflicts = items.filter((i) => i.syncStatus === "conflict").length;

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
          {conflicts > 0 ? ` ${conflicts} em conflito: escolha qual versão manter.` : ""}
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
          renderItem={({ item }) => <OccurrenceCard item={item} actions={actions} />}
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
  retry: { fontSize: 12, fontWeight: "700", color: "#2563EB", marginTop: 2 },
  cardId: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 16 },
  conflict: {
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  conflictTitle: { fontSize: 12, fontWeight: "700", color: "#5B21B6", marginBottom: 4 },
  conflictLabel: { fontSize: 10, fontWeight: "800", color: "#6B7280", marginTop: 4 },
  conflictText: { fontSize: 13, color: "#111827", lineHeight: 18 },
  conflictActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  conflictButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  conflictButtonPrimary: { backgroundColor: "#7C3AED" },
  conflictButtonText: { fontSize: 12, fontWeight: "700", color: "#7C3AED" },
  conflictButtonTextPrimary: { color: "#FFFFFF" },
});
