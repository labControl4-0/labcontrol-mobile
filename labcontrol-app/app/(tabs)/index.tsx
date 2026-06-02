<<<<<<< HEAD
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { clearAuth } from "../../services/tokenStorage";

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await clearAuth();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Ionicons name="git-network-outline" size={32} color="#1de8df" />
        </View>
        <Text style={styles.title}>LabControll 4.0</Text>
        <Text style={styles.subtitle}>Você está autenticado</Text>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#18dcd3" />
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
=======
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { login, saveAuthSession } from "../../lib/auth";  
import Toast from "react-native-toast-message";

export default function Index() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

const handleLogin = async () => {
  if (isSubmitting) return;

  if (!email.trim() || !password.trim()) {
    return Alert.alert("Erro", "Preencha todos os campos");
  }

  try {
    setIsSubmitting(true);

    const session = await login(email.trim(), password);

    await saveAuthSession(session);

    Toast.show({
      type: "success",
      text1: "Login realizado com sucesso !",
    });

    router.replace("/Dashboard");

  } catch (error) {
    Alert.alert(
      "Login failed",
      error instanceof Error ? error.message : "Erro ao logar"
    );
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.centeredContainer}>
          <View style={styles.loginCard}>
            <View style={styles.logoBox}>
              <Ionicons name="git-network-outline" size={26} color="#1de8df" />
            </View>

            <Text style={styles.title}>LabControll 4.0</Text>
            <Text style={styles.subtitle}>
              Enterprise Monitoring & Access
            </Text>

            <View style={styles.form}>
              {/* EMAIL */}
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="alternate-email"
                  size={20}
                  color="#9aa5bd"
                />
                <TextInput
                  style={styles.input}
                  placeholder="user@labcontroll.com"
                  placeholderTextColor="#9aa5bd"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* PASSWORD */}
              <Text style={[styles.label, styles.marginTop]}>
                PASSWORD
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#9aa5bd"
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#9aa5bd"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />

                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#9aa5bd"
                  />
                </Pressable>
              </View>

              {/* FORGOT */}
              <Pressable
                style={styles.forgotButton}
                onPress={() => router.push("/ForgotPassword")}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              {/* BUTTON */}
              <Pressable
                style={[
                  styles.signInButton,
                  isSubmitting && styles.signInButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.signInText}>
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#18dcd3" />
              </Pressable>
            </View>

            {/* CREATE ACCOUNT */}
            <View style={styles.bottomStrip}>
              <Pressable onPress={() => router.push("/CreateAccount")}>
                <Text style={styles.bottomText}>
                  New to the platform?{" "}
                  <Text style={styles.linkText}>Create account</Text>
                </Text>
              </Pressable>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerSecurity}>End-to-end Encrypted</Text>
            <Text style={styles.footerCopyright}>
              © 2024 LabControll Systems Inc.
            </Text>
          </View>
        </View>
      </ScrollView>
>>>>>>> origin/develop
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: {
    flex: 1,
    backgroundColor: "#dfe8f4",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#0c1736",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#18233f",
  },
  subtitle: {
    fontSize: 15,
    color: "#7082a2",
  },
  logoutButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#0b1738",
  },
  logoutText: {
=======
  safeArea: {
    flex: 1,
    backgroundColor: "#dfe8f4",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  centeredContainer: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },

  loginCard: {
    width: "100%",
    backgroundColor: "#f7f9fc",
    borderRadius: 18,
    paddingTop: 30,
    borderWidth: 1,
    borderColor: "#e9eef7",
  },

  logoBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#0c1736",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#18233f",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 11,
    color: "#7082a2",
    textAlign: "center",
    marginBottom: 26,
  },

  form: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34435f",
    marginBottom: 8,
  },

  marginTop: {
    marginTop: 14,
  },

  inputWrapper: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d6deeb",
    borderRadius: 8,
    backgroundColor: "#f1f4f9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    color: "#30405f",
    fontSize: 16,
    marginLeft: 8,
  },

  eyeButton: {
    padding: 4,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 10,
  },

  forgotText: {
    color: "#12a89f",
    fontSize: 14,
    fontWeight: "600",
  },

  signInButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#0b1738",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  signInButtonDisabled: {
    opacity: 0.6,
  },

  signInText: {
>>>>>>> origin/develop
    color: "#f4f7ff",
    fontSize: 15,
    fontWeight: "600",
  },
<<<<<<< HEAD
});
=======

  bottomStrip: {
    backgroundColor: "#edf2f8",
    borderTopWidth: 1,
    borderTopColor: "#e4ebf5",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },

  bottomText: {
    textAlign: "center",
    color: "#607394",
    fontSize: 13,
  },

  linkText: {
    color: "#0baea6",
    fontWeight: "700",
  },

  footer: {
    marginTop: 14,
    alignItems: "center",
  },

  footerSecurity: {
    color: "#8ea1be",
    fontSize: 13,
  },

  footerCopyright: {
    color: "#91a2bb",
    fontSize: 12,
  },
});
>>>>>>> origin/develop
