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

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.centeredContainer}>
          <View style={styles.card}>
            <View style={styles.contentArea}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.push("/")}
              >
                <Ionicons name="chevron-back" size={26} color="#52627d" />
              </Pressable>

              <View style={styles.iconBox}>
                <MaterialIcons name="lock-reset" size={34} color="#1CDAD4" />
              </View>

              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.description}>
                Enter your work email address below and we&apos;ll send you a
                secure link to reset your access credentials.
              </Text>

              <View style={styles.form}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="mail-outline" size={20} color="#9cadc6" />
                  <TextInput
                    style={styles.input}
                    placeholder="name@labcontroll.com"
                    placeholderTextColor="#a6b5ca"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <Pressable style={styles.sendButton}>
                  <Text style={styles.sendText}>Send Reset Link</Text>
                  <Ionicons name="arrow-forward" size={18} color="#15B0B1" />
                </Pressable>

                <Text style={styles.loginText}>
                  Remember your password?{" "}
                  <Text style={styles.loginLink} onPress={() => router.push("/")}>
                    Log in
                  </Text>
                </Text>
              </View>

              <View style={styles.footerWrap}>
                <Text style={styles.copyText}>
                  © 2024 LabControll Inc. All rights reserved.
                </Text>
              </View>
            </View>
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
    paddingVertical: 20,
  },
  centeredContainer: {
    width: "100%",
    maxWidth: 380,
  },
  card: {
    width: "100%",
    backgroundColor: "#f7f9fc",
    borderRadius: 18,
    paddingTop: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e9eef7",
  },
  contentArea: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  backButton: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 26,
  },
  iconBox: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#0B1738",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 26,
  },
  title: {
    textAlign: "center",
    color: "#18233f",
    fontWeight: "800",
    fontSize: 40 / 2,
    marginBottom: 12,
  },
  description: {
    textAlign: "center",
    color: "#667a9b",
    fontSize: 30 / 2,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  form: {
    gap: 12,
  },
  label: {
    color: "#33425f",
    fontWeight: "700",
    fontSize: 29 / 2,
    marginBottom: -2,
  },
  inputWrapper: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8e1ee",
    backgroundColor: "#f4f7fb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: "#33425f",
    fontSize: 16,
  },
  sendButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0B1738",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0B1738",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sendText: {
    color: "#eafffd",
    fontSize: 33 / 2,
    fontWeight: "700",
  },
  loginText: {
    marginTop: 30,
    textAlign: "center",
    color: "#657999",
    fontSize: 30 / 2,
  },
  loginLink: {
    color: "#1a9d95",
    fontWeight: "700",
  },
  footerWrap: {
    marginTop: 56,
    alignItems: "center",
  },
  copyText: {
    marginTop: 14,
    color: "#8ea1be",
    fontSize: 13,
  },
});
