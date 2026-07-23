import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { createQueueApi } from "../api/queue.api";
import { createPendingActionsQueue } from "../offline/pendingActionsQueue";
import { usePendingActionsSync } from "../offline/usePendingActionsSync";
import { createPendingActionSender } from "../offline/sendPendingAction";
import { PrimaryButton } from "../components/PrimaryButton";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { MAX_CONTENT_WIDTH } from "../theme/layout";
import type { RootStackParamList } from "../navigation/types";

export function MainScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Main">) {
  const { apiClient, logout } = useAuth();
  const queueApi = useMemo(() => createQueueApi(apiClient), [apiClient]);
  const pendingActionsQueue = useMemo(() => createPendingActionsQueue({ storage: AsyncStorage }), []);
  const sendAction = useMemo(() => createPendingActionSender(queueApi), [queueApi]);
  usePendingActionsSync({ pendingActionsQueue, sendAction });
  const [checkingCurrent, setCheckingCurrent] = useState(true);
  const [fetchingNext, setFetchingNext] = useState(false);
  const [emptyQueue, setEmptyQueue] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await queueApi.current();
      if (result.available) {
        navigation.replace("Item", { item: result.item });
        return;
      }
      setCheckingCurrent(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueApi]);

  async function handleNext() {
    setFetchingNext(true);
    setEmptyQueue(false);
    try {
      const result = await queueApi.next();
      if (result.available) {
        navigation.replace("Item", { item: result.item });
      } else {
        setEmptyQueue(true);
      }
    } finally {
      setFetchingNext(false);
    }
  }

  if (checkingCurrent) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <Text style={styles.message}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🧁</Text>
          </View>
          <Text style={styles.title}>Catavento</Text>
          {emptyQueue ? <Text style={styles.message}>Sem trabalho disponível no momento.</Text> : null}
          <PrimaryButton
            testID="main-next-button"
            title="Pegar próximo item"
            onPress={handleNext}
            disabled={fetchingNext}
            style={styles.fullWidthButton}
          />
          <PrimaryButton
            testID="main-logout-button"
            title="Sair"
            variant="secondary"
            onPress={logout}
            style={styles.fullWidthButton}
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
  // Mesmo raciocínio do LoginScreen — trava a largura numa coluna central
  // em telas grandes (tablet) em vez de esticar os botões de ponta a ponta.
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
    backgroundColor: colors.secondarySoft,
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
    marginBottom: 4,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  fullWidthButton: {
    width: "100%",
  },
});
