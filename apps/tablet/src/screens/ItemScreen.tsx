import React, { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { createQueueApi } from "../api/queue.api";
import { createPendingActionsQueue } from "../offline/pendingActionsQueue";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProductImageCarousel } from "../components/ProductImageCarousel";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import type { RootStackParamList } from "../navigation/types";

export function ItemScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "Item">) {
  const { item } = route.params;
  const { apiClient } = useAuth();
  const queueApi = useMemo(() => createQueueApi(apiClient), [apiClient]);
  const pendingActionsQueue = useMemo(() => createPendingActionsQueue({ storage: AsyncStorage }), []);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    setSubmitting(true);
    try {
      await queueApi.complete(item.id);
    } catch {
      await pendingActionsQueue.enqueue({ queueItemId: item.id, type: "complete" });
    } finally {
      setSubmitting(false);
      navigation.replace("Main");
    }
  }

  async function handleReportSubmit() {
    if (!note.trim()) {
      setNoteError("Descreva o problema antes de enviar.");
      return;
    }
    setNoteError(null);
    setSubmitting(true);
    try {
      await queueApi.problem(item.id, note);
    } catch {
      await pendingActionsQueue.enqueue({ queueItemId: item.id, type: "problem", note });
    } finally {
      setSubmitting(false);
      navigation.replace("Main");
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {item.product ? (
          <>
            <ProductImageCarousel images={item.product.images} />
            <Text style={styles.title}>{item.product.name}</Text>
            {item.product.description ? <Text style={styles.body}>{item.product.description}</Text> : null}
            {item.product.assemblyItems.length > 0 ? (
              <View style={styles.assemblyBox}>
                <Text style={styles.sectionTitle}>Itens para montagem</Text>
                {item.product.assemblyItems.map((assemblyItem, index) => (
                  <Text key={`${assemblyItem}-${index}`} style={styles.assemblyItem}>{`• ${assemblyItem}`}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.badge}>Produto sem cadastro</Text>
            <Text style={styles.body}>{JSON.stringify(item.payload)}</Text>
          </>
        )}
      </ScrollView>

      {reporting ? (
        <View style={styles.reportBox}>
          <TextInput
            testID="item-problem-note"
            style={styles.input}
            placeholder="Descreva o problema"
            value={note}
            onChangeText={setNote}
            multiline
          />
          {noteError ? <Text style={styles.error}>{noteError}</Text> : null}
          <PrimaryButton
            testID="item-problem-submit"
            title="Enviar"
            variant="secondary"
            onPress={handleReportSubmit}
            disabled={submitting}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <PrimaryButton
            testID="item-complete-button"
            title="Concluir"
            onPress={handleComplete}
            disabled={submitting}
          />
          <PrimaryButton
            testID="item-report-button"
            title="Reportar problema"
            variant="secondary"
            onPress={() => setReporting(true)}
            disabled={submitting}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  title: {
    ...typography.title,
    color: colors.secondary,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.secondary,
  },
  assemblyBox: {
    gap: 4,
  },
  assemblyItem: {
    ...typography.body,
    color: colors.text,
  },
  badge: {
    ...typography.label,
    color: colors.secondary,
    backgroundColor: colors.surfaceAlt,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actions: {
    marginTop: "auto",
    gap: 12,
  },
  reportBox: {
    marginTop: "auto",
    gap: 12,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: "top",
    ...typography.body,
  },
  error: {
    ...typography.label,
    color: colors.danger,
  },
});
