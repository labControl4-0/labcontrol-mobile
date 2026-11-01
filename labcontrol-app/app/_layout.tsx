import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { setUnauthorizedHandler } from "../services/api";

export default function RootLayout() {
  const router = useRouter();

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
