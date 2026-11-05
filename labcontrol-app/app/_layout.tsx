import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { purgeLegacyStorage } from "../lib/auth";
import { setUnauthorizedHandler } from "../services/api";
import { expoNetworkSource } from "../lib/offline/networkSource";
import { startAutoSync, startReconnectSync } from "../services/occurrenceSync";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Versões anteriores guardavam o token no AsyncStorage: remove na abertura.
    purgeLegacyStorage().catch(() => undefined);
  }, []);

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
