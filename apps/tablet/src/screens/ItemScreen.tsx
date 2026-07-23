import React, { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { createQueueApi } from "../api/queue.api";
import { createPendingActionsQueue } from "../offline/pendingActionsQueue";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProductImageCarousel } from "../components/ProductImageCarousel";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { MAX_CONTENT_WIDTH } from "../theme/layout";
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
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {item.product ? (
            <>
              {/* Full-bleed — a foto do produto ocupa a largura inteira da tela
                  (fora da coluna central), diferente do texto/botões abaixo. */}
              <ProductImageCarousel images={item.product.images} />
              <View style={styles.bodyColumn}>
                <Text style={styles.title}>{item.product.name}</Text>
                {item.product.description ? <Text style={styles.body}>{item.product.description}</Text> : null}
                {item.product.assemblyItems.length > 0 ? (
                  <Card style={styles.assemblyCard}>
                    <Text style={styles.sectionTitle}>
                      <Text aria-hidden>🧁 </Text>
                      <Text>Itens para montagem</Text>
                    </Text>
                    {item.product.assemblyItems.map((assemblyItem, index) => (
                      <Text key={`${assemblyItem}-${index}`} style={styles.assemblyItem}>{`• ${assemblyItem}`}</Text>
                    ))}
                  </Card>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.bodyColumn}>
              <Text style={styles.badge}>Produto sem cadastro</Text>
              <Card style={styles.rawPayloadCard}>
                <Text style={styles.body}>{JSON.stringify(item.payload)}</Text>
              </Card>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          {reporting ? (
            <Card style={styles.reportBox}>
              <TextInput
                testID="item-problem-note"
                style={styles.input}
                placeholder="Descreva o problema"
                placeholderTextColor={colors.textMuted}
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
                style={styles.fullWidthButton}
              />
            </Card>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Coluna central de leitura confortável — usada pro texto/cards, mas NÃO
  // pelo carrossel (esse fica full-bleed, fora dela, ver ProductImageCarousel).
  bodyColumn: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  // Mesma coluna central, mas pros botões de ação no rodapé (fora do ScrollView).
  bottomBar: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
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
    ...typography.sectionTitle,
    color: colors.secondary,
    marginBottom: 4,
  },
  assemblyCard: {
    padding: 18,
    gap: 6,
  },
  assemblyItem: {
    ...typography.body,
    color: colors.text,
  },
  badge: {
    ...typography.label,
    color: colors.secondary,
    backgroundColor: colors.secondarySoft,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rawPayloadCard: {
    padding: 18,
  },
  actions: {
    gap: 12,
  },
  reportBox: {
    padding: 18,
    gap: 12,
  },
  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.background,
    color: colors.text,
    textAlignVertical: "top",
    ...typography.body,
  },
  error: {
    ...typography.label,
    color: colors.danger,
  },
  fullWidthButton: {
    width: "100%",
  },
});
