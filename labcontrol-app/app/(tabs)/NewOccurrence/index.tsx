// Formulário de ocorrência de máquina. Grava primeiro no SQLite (funciona sem
// rede) e depois tenta enviar. O resultado mostrado é o estado real gravado.
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { getAuthSession } from "../../../lib/auth";
import {
  DESCRIPTION_MAX,
  EVENT_TYPES,
  formatLocalDateTime,
  validateOccurrence,
  type FormErrors,
} from "../../../lib/offline/occurrenceForm";
import {
  createOccurrence,
  getOccurrence,
  updateOccurrence,
} from "../../../lib/offline/occurrenceRepository";
import { notifySyncChanged, syncPendingOccurrences } from "../../../services/occurrenceSync";

const param = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default function NewOccurrenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const machine = useMemo(
    () => ({
      id: param(params.machineId),
      name: param(params.machineName),
      sectorId: param(params.sectorId),
      sectorName: param(params.sectorName) || null,
    }),
    [params.machineId, params.machineName, params.sectorId, params.sectorName]
  );

  // Edição (MOB-04): só para ocorrências ainda não enviadas.
  const editingId = param(params.occurrenceId);

  const [eventType, setEventType] = useState<string>("failure");
  const [description, setDescription] = useState("");
  const [occurredAtText, setOccurredAtText] = useState(() => formatLocalDateTime(new Date()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const session = await getAuthSession();
      const current = session?.user.id ? await getOccurrence(session.user.id, editingId) : null;
      if (!current) return;
      setEventType(current.eventType);
      setDescription(current.description);
      setOccurredAtText(formatLocalDateTime(new Date(current.occurredAt)));
    })().catch(() => undefined);
  }, [editingId]);

  const handleSave = async () => {
    if (saving) return;

    const result = validateOccurrence({
      machineId: machine.id,
      machineName: machine.name,
      sectorId: machine.sectorId,
      sectorName: machine.sectorName,
      eventType,
      description,
      occurredAtText,
    });

    if (!result.ok || !result.value) {
      setErrors(result.errors ?? {});
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const session = await getAuthSession();
      const userId = session?.user.id;
      if (!userId) {
        Toast.show({ type: "error", text1: "Sessão expirada", text2: "Faça login novamente." });
        router.replace("/");
        return;
      }

      let occurrenceId: string;
      if (editingId) {
        const updated = await updateOccurrence(userId, editingId, {
          eventType: result.value.eventType,
          description: result.value.description,
          occurredAt: result.value.occurredAt,
        });
        if (!updated) {
          Toast.show({
            type: "error",
            text1: "Não foi possível editar",
            text2: "A ocorrência já está sendo enviada ou já foi enviada.",
          });
          router.replace("/Occurrences" as any);
          return;
        }
        occurrenceId = editingId;
      } else {
        occurrenceId = (await createOccurrence({ ...result.value, userId })).id;
      }
      notifySyncChanged();

      // Tenta enviar na hora; sem rede ela continua pendente na fila.
      await syncPendingOccurrences({ trigger: "save" }).catch(() => null);
      const saved = await getOccurrence(userId, occurrenceId);

      if (saved?.syncStatus === "synced") {
        Toast.show({ type: "success", text1: "Ocorrência enviada ao servidor" });
      } else if (saved?.syncStatus === "conflict") {
        Toast.show({
          type: "error",
          text1: "Conflito com a versão do servidor",
          text2: "Escolha qual versão manter na lista de ocorrências.",
        });
      } else if (saved?.syncStatus === "failed") {
        Toast.show({
          type: "error",
          text1: "Servidor recusou a ocorrência",
          text2: saved.lastError ?? "Veja os detalhes na lista.",
        });
      } else {
        Toast.show({
          type: "info",
          text1: "Salva no aparelho: envio pendente",
          text2: "Será enviada automaticamente quando houver conexão.",
        });
      }

      router.replace("/Occurrences" as any);
    } catch {
      Toast.show({
        type: "error",
        text1: "Não foi possível salvar a ocorrência",
        text2: "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!machine.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Escolha uma máquina na tela de Máquinas.</Text>
          <TouchableOpacity onPress={() => router.replace("/Devices")}>
            <Text style={styles.link}>Ir para Máquinas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>{editingId ? "Editar ocorrência" : "Nova ocorrência"}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>MÁQUINA</Text>
            <Text style={styles.value}>{machine.name || machine.id}</Text>

            <Text style={[styles.label, styles.mt]}>SETOR</Text>
            <Text style={styles.value}>{machine.sectorName ?? (machine.sectorId || "—")}</Text>
            {errors.machineId || errors.sectorId ? (
              <Text style={styles.fieldError}>{errors.machineId ?? errors.sectorId}</Text>
            ) : null}
          </View>

          <Text style={styles.label}>TIPO</Text>
          <View style={styles.chips}>
            {EVENT_TYPES.map((t) => {
              const active = t.value === eventType;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setEventType(t.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.eventType ? <Text style={styles.fieldError}>{errors.eventType}</Text> : null}

          <Text style={[styles.label, styles.mt]}>DESCRIÇÃO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="O que aconteceu?"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={DESCRIPTION_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {description.length}/{DESCRIPTION_MAX}
          </Text>
          {errors.description ? <Text style={styles.fieldError}>{errors.description}</Text> : null}

          <Text style={[styles.label, styles.mt]}>DATA E HORA (DD/MM/AAAA HH:mm)</Text>
          <TextInput
            style={styles.input}
            value={occurredAtText}
            onChangeText={setOccurredAtText}
            placeholder="30/10/2026 14:30"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            maxLength={16}
          />
          {errors.occurredAtText ? (
            <Text style={styles.fieldError}>{errors.occurredAtText}</Text>
          ) : null}

          <Text style={styles.hint}>
            A ocorrência é salva no aparelho primeiro. Sem conexão, ela fica pendente e é enviada
            automaticamente depois.
          </Text>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {editingId ? "Salvar alterações" : "Salvar ocorrência"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scroll: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerSpacer: { width: 22 },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: "800", color: "#4B5563", marginBottom: 8 },
  value: { fontSize: 15, fontWeight: "600", color: "#111827" },
  mt: { marginTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: { backgroundColor: "#1E3A8A", borderColor: "#1E3A8A" },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { minHeight: 110 },
  counter: { alignSelf: "flex-end", fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  fieldError: { color: "#B91C1C", fontSize: 12, marginTop: 6 },
  hint: { fontSize: 12, color: "#6B7280", marginTop: 18, lineHeight: 18 },
  button: {
    marginTop: 18,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#0B1738",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  errorText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  link: { fontSize: 14, fontWeight: "700", color: "#2563EB" },
});
