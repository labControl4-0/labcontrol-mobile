import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BottomNavBar } from "./components/BottomNavBar";
import { getAuthSession } from "../lib/auth";
import {
  parseMachineEventPushPayload,
  type MachineEventPushPayload,
} from "../lib/push/notificationPayload";
import { apiFetch } from "../services/api";

type MachineEvent = {
  id: string;
  machineId: string;
  eventType: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

type ScreenState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "ready"; payload: MachineEventPushPayload; event: MachineEvent };

const CATEGORY_LABELS: Record<MachineEventPushPayload["categoria"], string> = {
  failure: "Falha",
  warning: "Aviso",
  maintenance: "Manutenção",
  note: "Informativo",
};

function findAuthorizedEvent(
  value: unknown,
  payload: MachineEventPushPayload
): MachineEvent | null {
  if (!Array.isArray(value)) return null;

  const candidate = value.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.id === "string" &&
      row.id.toLowerCase() === payload.avisoId &&
      typeof row.machineId === "string" &&
      row.machineId.toLowerCase() === payload.machineId &&
      typeof row.eventType === "string" &&
      row.eventType.trim().toLowerCase() === payload.categoria &&
      typeof row.message === "string" &&
      typeof row.createdAt === "string"
    );
  });

  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  return {
    id: row.id as string,
    machineId: row.machineId as string,
    eventType: row.eventType as string,
    message: row.message as string,
    createdAt: row.createdAt as string,
    resolvedAt: typeof row.resolvedAt === "string" ? row.resolvedAt : null,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR");
}

export default function NotificationEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    categoria?: string;
    avisoId?: string;
    machineId?: string;
    origem?: string;
  }>();
  const [state, setState] = useState<ScreenState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    const load = async () => {
      const payload = parseMachineEventPushPayload({
        categoria: params.categoria,
        avisoId: params.avisoId,
        machineId: params.machineId,
        origem: params.origem,
      });

      if (!payload) {
        if (active) setState({ status: "invalid" });
        return;
      }

      const session = await getAuthSession().catch(() => null);
      if (!session?.user.id) {
        if (active) router.replace("/");
        return;
      }

      try {
        // O backend confere o acesso do usuário à máquina. O ID do push só
        // seleciona o evento dentro da resposta autorizada; não libera acesso.
        const events = await apiFetch(
          "/machine-events/machine/" + encodeURIComponent(payload.machineId),
          { authToken: session.token }
        );
        const event = findAuthorizedEvent(events, payload);
        const currentSession = await getAuthSession().catch(() => null);

        if (!active) return;
        if (!currentSession?.user.id) {
          router.replace("/");
          return;
        }
        if (
          currentSession.user.id !== session.user.id ||
          currentSession.token !== session.token ||
          !event
        ) {
          setState({ status: "unavailable" });
          return;
        }

        setState({ status: "ready", payload, event });
      } catch {
        if (active) setState({ status: "unavailable" });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [params.categoria, params.avisoId, params.machineId, params.origem, router]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/Notifications");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhe do aviso</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.status === "loading" ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />
      ) : state.status === "ready" ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.categoryBadge}>
            <Ionicons name="notifications-outline" size={17} color="#1D4ED8" />
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[state.payload.categoria]}
            </Text>
          </View>

          <Text style={styles.eventMessage}>{state.event.message}</Text>
          <Text style={styles.dateText}>Recebido em {formatDate(state.event.createdAt)}</Text>

          <View style={styles.detailsCard}>
            <Text style={styles.detailLabel}>ID do aviso</Text>
            <Text selectable style={styles.detailValue}>{state.event.id}</Text>

            <Text style={styles.detailLabel}>Categoria</Text>
            <Text style={styles.detailValue}>{CATEGORY_LABELS[state.payload.categoria]}</Text>

            <Text style={styles.detailLabel}>Origem (data.origem)</Text>
            <Text selectable style={styles.detailValue}>{state.payload.origem}</Text>

            <Text style={styles.detailLabel}>Máquina</Text>
            <Text selectable style={styles.detailValue}>{state.event.machineId}</Text>

            <Text style={styles.detailLabel}>Estado</Text>
            <Text style={styles.detailValue}>
              {state.event.resolvedAt ? "Resolvido" : "Em aberto"}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.messageState}>
          <Ionicons
            name={state.status === "invalid" ? "warning-outline" : "lock-closed-outline"}
            size={34}
            color={state.status === "invalid" ? "#B45309" : "#6B7280"}
          />
          <Text style={styles.messageTitle}>
            {state.status === "invalid" ? "Aviso inválido" : "Aviso indisponível"}
          </Text>
          <Text style={styles.messageBody}>
            {state.status === "invalid"
              ? "O conteúdo da notificação não identifica um evento válido."
              : "O evento não existe ou sua conta não tem acesso a ele."}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/Notifications")}
            accessibilityRole="button"
            style={styles.returnButton}
          >
            <Text style={styles.returnButtonText}>Ir para notificações</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomNavBar activeTab="notifications" />
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
    paddingVertical: 14,
  },
  backButton: { width: 34, alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerSpacer: { width: 34 },
  loader: { marginTop: 56 },
  content: { paddingHorizontal: 22, paddingBottom: 132 },
  categoryBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  categoryText: { color: "#1D4ED8", fontWeight: "700", fontSize: 13 },
  eventMessage: { color: "#111827", fontSize: 17, lineHeight: 25, marginTop: 20 },
  dateText: { color: "#6B7280", fontSize: 13, marginTop: 10 },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginTop: 22,
    gap: 7,
  },
  detailLabel: { color: "#6B7280", fontSize: 12, fontWeight: "600", marginTop: 8 },
  detailValue: { color: "#111827", fontSize: 14, lineHeight: 20 },
  messageState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  messageTitle: { color: "#111827", fontSize: 18, fontWeight: "700", marginTop: 14 },
  messageBody: { color: "#6B7280", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  returnButton: {
    backgroundColor: "#0B1738",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 20,
  },
  returnButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
