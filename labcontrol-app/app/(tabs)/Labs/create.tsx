import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { createPlant, type CreatePlantInput } from "../../../lib/plants";

type FormValues = {
  name: string;
  description: string;
  scale: string;
  widthUnits: string;
  heightUnits: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialForm: FormValues = {
  name: "",
  description: "",
  scale: "",
  widthUnits: "",
  heightUnits: "",
};

function parsePositiveNumber(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function CreateLabScreen() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSave = async () => {
    if (saving) return;

    const scale = parsePositiveNumber(form.scale);
    const widthUnits = parsePositiveNumber(form.widthUnits);
    const heightUnits = parsePositiveNumber(form.heightUnits);
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) nextErrors.name = "Informe o nome do laboratório.";
    if (!form.description.trim()) {
      nextErrors.description = "Informe uma descrição.";
    }
    if (scale === null) nextErrors.scale = "Informe um valor maior que zero.";
    if (widthUnits === null) {
      nextErrors.widthUnits = "Informe um valor maior que zero.";
    }
    if (heightUnits === null) {
      nextErrors.heightUnits = "Informe um valor maior que zero.";
    }

    if (
      Object.keys(nextErrors).length > 0 ||
      scale === null ||
      widthUnits === null ||
      heightUnits === null
    ) {
      setErrors(nextErrors);
      return;
    }

    const input: CreatePlantInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      scale,
      widthUnits,
      heightUnits,
    };

    setSaving(true);
    try {
      await createPlant(input);
      Toast.show({
        type: "success",
        text1: "Laboratório cadastrado",
        text2: "Os dados foram salvos no servidor.",
      });
      router.back();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Não foi possível cadastrar",
        text2:
          error instanceof Error
            ? error.message
            : "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>Novo laboratório</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.subtitle}>
            Preencha as informações para cadastrar o laboratório no sistema.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>NOME</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={form.name}
              onChangeText={(value) => updateField("name", value)}
              placeholder="Ex.: Laboratório de automação"
              placeholderTextColor="#9CA3AF"
              maxLength={120}
              returnKeyType="next"
            />
            {errors.name ? (
              <Text style={styles.fieldError}>{errors.name}</Text>
            ) : null}

            <Text style={[styles.label, styles.spacedLabel]}>DESCRIÇÃO</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                errors.description && styles.inputError,
              ]}
              value={form.description}
              onChangeText={(value) => updateField("description", value)}
              placeholder="Descreva o laboratório"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            {errors.description ? (
              <Text style={styles.fieldError}>{errors.description}</Text>
            ) : null}

            <Text style={[styles.label, styles.spacedLabel]}>ESCALA</Text>
            <TextInput
              style={[styles.input, errors.scale && styles.inputError]}
              value={form.scale}
              onChangeText={(value) => updateField("scale", value)}
              placeholder="Ex.: 1"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
            {errors.scale ? (
              <Text style={styles.fieldError}>{errors.scale}</Text>
            ) : null}

            <Text style={[styles.label, styles.spacedLabel]}>
              LARGURA (UNIDADES)
            </Text>
            <TextInput
              style={[styles.input, errors.widthUnits && styles.inputError]}
              value={form.widthUnits}
              onChangeText={(value) => updateField("widthUnits", value)}
              placeholder="Ex.: 100"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
            {errors.widthUnits ? (
              <Text style={styles.fieldError}>{errors.widthUnits}</Text>
            ) : null}

            <Text style={[styles.label, styles.spacedLabel]}>
              ALTURA (UNIDADES)
            </Text>
            <TextInput
              style={[styles.input, errors.heightUnits && styles.inputError]}
              value={form.heightUnits}
              onChangeText={(value) => updateField("heightUnits", value)}
              placeholder="Ex.: 100"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
            {errors.heightUnits ? (
              <Text style={styles.fieldError}>{errors.heightUnits}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Salvar laboratório</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scroll: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerSpacer: { width: 22 },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 18,
  },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16 },
  label: { fontSize: 12, fontWeight: "800", color: "#4B5563", marginBottom: 8 },
  spacedLabel: { marginTop: 16 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: "#111827",
  },
  inputError: { borderColor: "#DC2626" },
  textArea: { minHeight: 96 },
  fieldError: { color: "#B91C1C", fontSize: 12, marginTop: 6 },
  button: {
    marginTop: 20,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#0B1738",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
