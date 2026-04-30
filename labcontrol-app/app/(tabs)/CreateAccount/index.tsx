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
import { registerUser, saveAuthSession } from "../../../lib/auth";
import Toast from "react-native-toast-message";

export default function CreateAccount() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


const handleCreateAccount = async () => {
  if (isSubmitting) return;

  try {
    setIsSubmitting(true);

    const user = await registerUser(
      fullName.trim(),
      email.trim(),
      password
    );

    await saveAuthSession(user);

    Toast.show({
      type: "success",
      text1: "Conta criada com sucesso 🎉",
    });

    router.replace("/Dashboard");

  } catch (error) {
    Alert.alert(
      "Registration failed",
      error instanceof Error ? error.message : "Unexpected error"
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
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={[styles.label, styles.marginTop]}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="alternate-email" size={20} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  placeholder="user@email.com"
                  placeholderTextColor="#9aa5bd"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={[styles.label, styles.marginTop]}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#9aa5bd"
                  />
                </Pressable>
              </View>

              <Text style={[styles.label, styles.marginTop]}>
                CONFIRM PASSWORD
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#9aa5bd" />
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Pressable
                  onPress={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword
                        ? "eye-outline"
                        : "eye-off-outline"
                    }
                    size={20}
                    color="#9aa5bd"
                  />
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.createButton,
                  isSubmitting && styles.createButtonDisabled,
                ]}
                onPress={handleCreateAccount}
                disabled={isSubmitting}
              >
                <Text style={styles.createButtonText}>
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ✅ FORA do componente
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
  createButton: {
    marginTop: 16,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#0b1738",
    justifyContent: "center",
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#f4f7ff",
    fontSize: 15,
    fontWeight: "600",
  },
});