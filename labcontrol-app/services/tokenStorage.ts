import AsyncStorage from "@react-native-async-storage/async-storage";

import type { LoginResponse } from "../types/auth";

const TOKEN_KEY = "@labcontrol:token";
const USER_KEY = "@labcontrol:user";

export const saveToken = (token: string) =>
  AsyncStorage.setItem(TOKEN_KEY, token);

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);

export const saveUser = (user: Omit<LoginResponse, "token">) =>
  AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

export const getUser = async (): Promise<Omit<
  LoginResponse,
  "token"
> | null> => {
  const json = await AsyncStorage.getItem(USER_KEY);
  return json ? JSON.parse(json) : null;
};

export const clearAuth = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
};
