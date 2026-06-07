import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { register } from "../../../lib/auth";

export default function CreateAccount() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearError = () => setError("");

  const handleCreateAccount = async () => {
    setError("");

    if (!fullName.trim()) {
      setError("Por favor, informe seu nome completo.");
      return;
    }
    if (!email.trim()) {
      setError("Por favor, informe o e-mail.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      router.replace("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao criar conta. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.centeredContainer}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#18233f" />
            </Pressable>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.createAccountCard}>
            <View style={styles.logoBox}>
              <Ionicons name="git-network-outline" size={26} color="#1de8df" />
            </View>

            <Text style={styles.title}>LabControll 4.0</Text>
            <Text style={styles.subtitle}>Join Our Platform</Text>

            <View style={styles.form}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="person-outline" size={20} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#9aa5bd"
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); clearError(); }}
                  editable={!loading}
                />
              </View>

              <Text style={[styles.label, styles.marginTop]}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="alternate-email" size={20} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  placeholder="user@email.com"
                  placeholderTextColor="#9aa5bd"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => { setEmail(v); clearError(); }}
                  editable={!loading}
                />
              </View>

              <Text style={[styles.label, styles.marginTop]}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#9aa5bd"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearError(); }}
                  editable={!loading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#9aa5bd"
                  />
                </Pressable>
              </View>

              <Text style={[styles.label, styles.marginTop]}>CONFIRM PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#9aa5bd"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); clearError(); }}
                  editable={!loading}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#9aa5bd"
                  />
                </Pressable>
              </View>

              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  By creating an account, you agree to our{" "}
                  <Text style={styles.linkText}>Terms of Service</Text> and{" "}
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.createButton, loading && styles.buttonDisabled]}
                onPress={handleCreateAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#18dcd3" />
                ) : (
                  <>
                    <Text style={styles.createButtonText}>Create Account</Text>
                    <Ionicons name="chevron-forward" size={18} color="#18dcd3" />
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.bottomStrip}>
              <Text style={styles.bottomText}>
                Already have an account?{" "}
                <Pressable onPress={() => router.push("/")}>
                  <Text style={styles.bottomLinkText}>Sign In</Text>
                </Pressable>
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerSecurity}>End-to-end Encrypted</Text>
            <Text style={styles.footerCopyright}>
              © 2024 LabControll Systems Inc.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#dfe8f4",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  centeredContainer: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18233f",
  },
  createAccountCard: {
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
    paddingBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34435f",
    letterSpacing: 0.8,
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
    gap: 8,
  },
  input: {
    flex: 1,
    color: "#30405f",
    fontSize: 16,
  },
  eyeButton: {
    padding: 4,
  },
  termsContainer: {
    marginTop: 14,
    marginBottom: 12,
  },
  termsText: {
    color: "#607394",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  linkText: {
    color: "#0baea6",
    fontWeight: "700",
  },
  errorText: {
    color: "#e05252",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  createButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: "#0b1738",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: "#f4f7ff",
    fontSize: 15,
    fontWeight: "600",
  },
  bottomStrip: {
    backgroundColor: "#edf2f8",
    borderTopWidth: 1,
    borderTopColor: "#e4ebf5",
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  bottomText: {
    textAlign: "center",
    color: "#607394",
    fontSize: 13,
  },
  bottomLinkText: {
    color: "#0baea6",
    fontWeight: "700",
  },
  footer: {
    marginTop: 14,
    alignItems: "center",
    gap: 4,
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
