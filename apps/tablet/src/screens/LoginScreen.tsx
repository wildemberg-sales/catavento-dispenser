import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { ApiClientError } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { MAX_CONTENT_WIDTH } from "../theme/layout";
import type { RootStackParamList } from "../navigation/types";

export function LoginScreen(_props: NativeStackScreenProps<RootStackParamList, "Login">) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError("Usuário e senha são obrigatórios.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🎂</Text>
          </View>
          <Text style={styles.title}>Catavento</Text>
          <Text style={styles.subtitle}>Entre com sua conta de operador</Text>
          <TextInput
            testID="login-username"
            style={styles.input}
            placeholder="Usuário"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            testID="login-password"
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            testID="login-submit"
            title="Entrar"
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.submitButton}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  // width/maxWidth/alignSelf — em telas largas (tablet) o formulário fica
  // centralizado numa coluna de leitura confortável, em vez de esticar os
  // inputs/botão de ponta a ponta da tela.
  card: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    alignItems: "center",
    padding: 32,
    gap: 14,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  badgeIcon: {
    fontSize: 36,
  },
  title: {
    ...typography.title,
    color: colors.secondary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    color: colors.text,
    ...typography.body,
  },
  error: {
    ...typography.label,
    color: colors.danger,
    textAlign: "center",
  },
  submitButton: {
    width: "100%",
    marginTop: 4,
  },
});
