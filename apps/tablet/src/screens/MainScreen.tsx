import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { createQueueApi } from "../api/queue.api";
import { createPendingActionsQueue } from "../offline/pendingActionsQueue";
import { usePendingActionsSync } from "../offline/usePendingActionsSync";
import { createPendingActionSender } from "../offline/sendPendingAction";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
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
      <View style={styles.container}>
        <Text style={styles.message}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catavento</Text>
      {emptyQueue ? <Text style={styles.message}>Sem trabalho disponível no momento.</Text> : null}
      <PrimaryButton
        testID="main-next-button"
        title="Pegar próximo item"
        onPress={handleNext}
        disabled={fetchingNext}
      />
      <PrimaryButton testID="main-logout-button" title="Sair" variant="secondary" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  title: {
    ...typography.title,
    color: colors.secondary,
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
  },
});
