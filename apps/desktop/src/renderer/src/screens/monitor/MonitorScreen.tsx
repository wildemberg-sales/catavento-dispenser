import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { createUsersApi } from "../../api/users.api";
import { useMonitorStream, type MonitorEvent } from "../../monitor/useMonitorStream";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

type ActivityEntry = { id: string; icon: string; text: string };

const MAX_FEED_ENTRIES = 30;

export function MonitorScreen() {
  const { apiClient } = useAuth();
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);
  const usersApi = useMemo(() => createUsersApi(apiClient), [apiClient]);

  const [queueSize, setQueueSize] = useState<number | null>(null);
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
  const [onlineOperatorIds, setOnlineOperatorIds] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<ActivityEntry[]>([]);
  const feedSequenceRef = useRef(0);

  useEffect(() => {
    adminQueueApi.list({ status: "pending", pageSize: 1 }).then((result) => setQueueSize(result.total));
    usersApi.list({ role: "operator" }).then((result) => {
      const map: Record<string, string> = {};
      for (const user of result.items) map[user.id] = user.displayName;
      setOperatorNames(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminQueueApi, usersApi]);

  const nameFor = useCallback((operatorId: string) => operatorNames[operatorId] ?? operatorId, [operatorNames]);

  const pushFeedEntry = useCallback((icon: string, text: string) => {
    feedSequenceRef.current += 1;
    const id = `entry-${feedSequenceRef.current}`;
    setFeed((current) => [{ id, icon, text }, ...current].slice(0, MAX_FEED_ENTRIES));
  }, []);

  const handleEvent = useCallback(
    (event: MonitorEvent) => {
      switch (event.type) {
        case "item_assigned":
          setQueueSize(event.payload.queueSize);
          pushFeedEntry("📦", `Item atribuído a ${nameFor(event.payload.operatorId)}`);
          break;
        case "item_completed":
          if (event.payload.outcome === "problem") {
            pushFeedEntry("⚠️", `Item relatado com problema por ${nameFor(event.payload.operatorId)}`);
          } else {
            pushFeedEntry("✅", `Item concluído por ${nameFor(event.payload.operatorId)}`);
          }
          break;
        case "operator_online":
          setOnlineOperatorIds((current) => new Set(current).add(event.payload.operatorId));
          pushFeedEntry("🟢", `${nameFor(event.payload.operatorId)} entrou`);
          break;
        case "operator_offline":
          setOnlineOperatorIds((current) => {
            const next = new Set(current);
            next.delete(event.payload.operatorId);
            return next;
          });
          pushFeedEntry("🔴", `${nameFor(event.payload.operatorId)} saiu`);
          break;
        case "queue_size_changed":
          setQueueSize(event.payload.queueSize);
          break;
      }
    },
    [nameFor, pushFeedEntry]
  );

  useMonitorStream({
    baseUrl: apiClient.getBaseUrl(),
    getAccessToken: () => apiClient.getAccessToken(),
    onEvent: handleEvent,
    fetchImpl: apiClient.getFetchImpl(),
  });

  return (
    <div style={styles.container}>
      <PageHeader title="Monitor ao vivo" subtitle="Acompanhamento em tempo real da produção" />

      <div style={styles.statsRow}>
        <Card style={styles.statCard}>
          <span style={styles.statLabel}>Itens na fila</span>
          <span data-testid="queue-size-value" style={styles.statValue}>
            {queueSize ?? "…"}
          </span>
        </Card>
        <Card style={styles.statCard}>
          <span style={styles.statLabel}>Operadores online</span>
          <span data-testid="online-count-value" style={styles.statValue}>
            {onlineOperatorIds.size}
          </span>
        </Card>
      </div>

      {onlineOperatorIds.size > 0 ? (
        <Card style={styles.onlineCard}>
          <h2 style={styles.sectionTitle}>Operadores online agora</h2>
          <div style={styles.onlineList}>
            {[...onlineOperatorIds].map((id) => (
              <span key={id} className="badge" style={styles.onlineBadge}>
                {nameFor(id)}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <Card style={styles.feedCard}>
        <h2 style={styles.sectionTitle}>Atividade recente</h2>
        {feed.length === 0 ? (
          <p style={styles.emptyText}>Nenhuma atividade ainda nesta sessão.</p>
        ) : (
          <ul style={styles.feedList}>
            {feed.map((entry) => (
              <li key={entry.id} style={styles.feedItem}>
                <span aria-hidden="true">{entry.icon}</span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  statsRow: { display: "flex", flexWrap: "wrap", gap: 16 },
  statCard: { padding: 20, minWidth: 180, display: "flex", flexDirection: "column", gap: 6 },
  statLabel: { ...typography.label, color: colors.textMuted },
  statValue: { ...typography.title, color: colors.secondary },
  onlineCard: { padding: 20, display: "flex", flexDirection: "column", gap: 10 },
  onlineList: { display: "flex", flexWrap: "wrap", gap: 8 },
  onlineBadge: { color: colors.success, backgroundColor: colors.successSoft },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  feedCard: { padding: 20, display: "flex", flexDirection: "column", gap: 10 },
  emptyText: { ...typography.body, color: colors.textMuted, margin: 0 },
  feedList: { display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" },
  feedItem: { ...typography.body, color: colors.text, display: "flex", gap: 8, alignItems: "center" },
};
