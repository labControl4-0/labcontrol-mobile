// Cartão "Notificações neste aparelho" (MOB-05): os passos da aula de push.
// Permissão negada, emulador e servidor sem a rota viram mensagens, nunca erro.
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Toast from "react-native-toast-message";

import { sendLocalTestNotification, type PermissionState } from "../../lib/push/notifications";
import {
  getPushStatus,
  setupPushNotifications,
  type PushSetupResult,
} from "../../services/pushRegistration";

const PERMISSION_LABEL: Record<PermissionState["status"], string> = {
  granted: "Permitidas",
  denied: "Bloqueadas",
  undetermined: "Ainda não autorizadas",
  unsupported: "Não suportadas neste ambiente",
};

function describe(result: PushSetupResult): { text: string; tone: "ok" | "warn" | "error" } {
  switch (result.status) {
    case "registered":
      return {
        text: result.alreadyRegistered ? "Aparelho já registrado." : "Aparelho registrado no servidor.",
        tone: "ok",
      };
    case "permission_denied":
      return {
        text: result.canAskAgain
          ? "Permissão negada. O app continua funcionando sem notificações."
          : "Permissão bloqueada. Ative nas configurações do sistema para receber alertas.",
        tone: "warn",
      };
    case "permission_pending":
      return { text: "Toque em Ativar notificações para autorizar.", tone: "warn" };
    case "server_unavailable":
      return { text: `Token gerado, mas não registrado: ${result.message}`, tone: "warn" };
    case "no_session":
      return { text: "Entre na sua conta para registrar o aparelho.", tone: "error" };
    default:
      return { text: result.message, tone: "error" };
  }
}

export function PushSetupCard() {
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<ReturnType<typeof describe> | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getPushStatus()
      .then((s) => {
        setPermission(s.permission);
        setMaskedToken(s.maskedToken);
      })
      .catch(() => undefined);
  }, []);

  useFocusEffect(refresh);

  const handleActivate = async () => {
    setBusy(true);
    try {
      const result = await setupPushNotifications({ prompt: true, force: true });
      setMessage(describe(result));
      if ("maskedToken" in result) setMaskedToken(result.maskedToken);
    } catch {
      setMessage({ text: "Não foi possível ativar as notificações.", tone: "error" });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const handleLocalTest = async () => {
    const sent = await sendLocalTestNotification();
    Toast.show(
      sent
        ? { type: "success", text1: "Notificação local enviada" }
        : { type: "info", text1: "Autorize as notificações primeiro" }
    );
  };

  const blocked = permission?.status === "denied" && !permission.canAskAgain;
  const unsupported = permission?.status === "unsupported";

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="phone-portrait-outline" size={18} color="#1E3A8A" />
        <Text style={styles.title}>Notificações neste aparelho</Text>
      </View>

      <Text style={styles.line}>
        Situação: {permission ? PERMISSION_LABEL[permission.status] : "verificando..."}
      </Text>
      <Text style={styles.line}>Push token: {maskedToken ?? "ainda não registrado"}</Text>

      {message ? (
        <Text
          style={[
            styles.message,
            message.tone === "ok" ? styles.ok : message.tone === "warn" ? styles.warn : styles.error,
          ]}
        >
          {message.text}
        </Text>
      ) : null}

      {unsupported ? null : (
        <View style={styles.actions}>
          {blocked ? (
            <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
              <Text style={styles.buttonText}>Abrir configurações</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleActivate} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {permission?.status === "granted" ? "Registrar aparelho" : "Ativar notificações"}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleLocalTest}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Notificação local</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 18, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "700", color: "#111827" },
  line: { fontSize: 12, color: "#4B5563" },
  message: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  ok: { color: "#15803D" },
  warn: { color: "#B45309" },
  error: { color: "#B91C1C" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  button: {
    backgroundColor: "#0B1738",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#0B1738" },
  secondaryText: { color: "#0B1738" },
});
