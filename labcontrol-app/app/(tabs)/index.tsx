import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Index() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
            <Text style={styles.subtitle}>Enterprise Monitoring & Access</Text>

            <View style={styles.form}>
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

              <Text style={[styles.label, styles.passwordLabel]}>PASSWORD</Text>
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

              <Pressable
                style={styles.forgotButton}
                onPress={() => router.push("/ForgotPassword")}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              <Pressable style={styles.signInButton}>
                <Text style={styles.signInText}>Sign In</Text>
                <Ionicons name="chevron-forward" size={18} color="#18dcd3" />
              </Pressable>
            </View>

            <View style={styles.bottomStrip}>
              <Pressable onPress={() => router.push("/CreateAccount")}>
                <Text style={styles.bottomText}>
                  New to the platform?{" "}
                  <Text style={styles.linkText}>Create account</Text>
                </Text>
              </Pressable>
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
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  centeredContainer: {
    width: "100%",
    maxWidth: 380,
  },
  loginCard: {
    width: "100%",
    backgroundColor: "#f7f9fc",
    borderRadius: 18,
    paddingTop: 30,
    overflow: "hidden",
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
    shadowColor: "#0b1230",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: {
    fontSize: 42 / 2,
    fontWeight: "800",
    color: "#18233f",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 22 / 2,
    color: "#7082a2",
    textAlign: "center",
    marginBottom: 26,
    letterSpacing: 0.2,
  },
  form: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34435f",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  passwordLabel: {
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
    shadowColor: "#0b1230",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  signInText: {
    color: "#f4f7ff",
    fontSize: 30 / 2,
    fontWeight: "500",
  },
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
    fontSize: 26 / 2,
  },
  linkText: {
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
