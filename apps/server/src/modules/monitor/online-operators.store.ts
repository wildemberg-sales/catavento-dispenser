// Estado "quem está online" em memória (Seção 9.1, só uma estação de
// gerência — mesma decisão do MonitorBus). Isso NÃO existia antes: os
// eventos operator_online/operator_offline eram só pass-through no
// MonitorBus, sem nenhum lugar guardando o estado atual — por isso a tela de
// Monitor não tinha como hidratar um snapshot ao abrir, só via eventos ao
// vivo a partir daquele momento.
export type OnlineOperator = { operatorId: string; displayName: string };

export class OnlineOperatorsStore {
  private readonly operators = new Map<string, { displayName: string; lastSeenAt: number }>();

  markOnline(operatorId: string, displayName: string, now: number = Date.now()): void {
    this.operators.set(operatorId, { displayName, lastSeenAt: now });
  }

  markOffline(operatorId: string): void {
    this.operators.delete(operatorId);
  }

  // Heartbeat periódico do app do operador. Se o operador não estava
  // rastreado (ex.: o processo do servidor reiniciou e perdeu o estado em
  // memória, mas o app do operador continua com um token válido), o touch
  // se autocura registrando-o como online de novo — sem isso, um restart do
  // servidor deixaria operadores realmente ativos escondidos até o próximo
  // login/logout explícito.
  touch(operatorId: string, displayName: string, now: number = Date.now()): void {
    this.markOnline(operatorId, displayName, now);
  }

  // Só pra isolar testes que usam o singleton compartilhado (o store real
  // nunca precisa disso em produção).
  clear(): void {
    this.operators.clear();
  }

  listOnline(): OnlineOperator[] {
    return Array.from(this.operators.entries()).map(([operatorId, { displayName }]) => ({
      operatorId,
      displayName,
    }));
  }

  // Varredura periódica (ver online-operators-sweep.job.ts): qualquer
  // operador sem heartbeat há mais que `timeoutMs` é considerado offline —
  // cobre o caso de app derrubado/sem rede, que nunca chama /auth/logout.
  sweepStale(timeoutMs: number, now: number = Date.now()): string[] {
    const stale: string[] = [];
    for (const [operatorId, { lastSeenAt }] of this.operators.entries()) {
      if (now - lastSeenAt > timeoutMs) {
        stale.push(operatorId);
      }
    }
    for (const operatorId of stale) {
      this.operators.delete(operatorId);
    }
    return stale;
  }
}

export const onlineOperatorsStore = new OnlineOperatorsStore();
