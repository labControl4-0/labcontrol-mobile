import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { purgeLegacyStorage } from "../lib/auth";
import { setUnauthorizedHandler } from "../services/api";
import { expoNetworkSource } from "../lib/offline/networkSource";
import { startAutoSync, startReconnectSync } from "../services/occurrenceSync";
import { ensureAndroidChannel, installNotificationHandler } from "../lib/push/notifications";
import { setupPushNotifications } from "../services/pushRegistration";
import { startPushNavigation } from "../services/pushNavigation";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Versões anteriores guardavam o token no AsyncStorage: remove na abertura.
    purgeLegacyStorage().catch(() => undefined);
  }, []);

  // Notificações (MOB-05): canal Android e exibição com o app aberto. Com sessão
  // e permissão já concedida, registra o aparelho sem mostrar nenhum pedido.
  useEffect(() => {
    installNotificationHandler();
    ensureAndroidChannel()
      .then(() => setupPushNotifications({ prompt: false }))
      .catch(() => undefined);
  }, []);

  // Push (MOB-06): o handler apresenta o aviso em primeiro plano; o observer
  // valida o clique tanto em app aberto quanto no início a partir da bandeja.
  useEffect(
    () =>
      startPushNavigation((href) => router.push(href), {
        onReceived: (payload) => {
          if (!payload) return;
          Toast.show({
            type: "info",
            text1: "Novo aviso recebido",
            text2: "Toque na notificação para abrir o evento.",
          });
        },
        onResponse: (status) => {
          if (status === "invalid_payload") {
            Toast.show({
              type: "error",
              text1: "Notificação inválida",
              text2: "Não foi possível abrir o evento.",
            });
          } else if (status === "no_session") {
            Toast.show({
              type: "info",
              text1: "Entre novamente para abrir este aviso.",
            });
          }
        },
      }),
    [router]
  );

  // Fila offline: tenta enviar ao abrir o app, ao voltar para ele e a cada 30 s
  // (respeitando o backoff), e uma vez sempre que a conexão volta.
  useEffect(() => startAutoSync(), []);
  useEffect(() => startReconnectSync(expoNetworkSource), []);

  useEffect(() => {
    // Sessão expirada (401): api.ts já limpou a sessão; aqui só voltamos ao login.
    setUnauthorizedHandler(() => {
      Toast.show({
        type: "error",
        text1: "Sessão expirada",
        text2: "Faça login novamente.",
      });
      router.replace("/");
    });

    return () => setUnauthorizedHandler(null);
  }, [router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}
