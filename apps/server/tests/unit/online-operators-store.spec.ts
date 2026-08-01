import { describe, expect, it } from "vitest";
import { OnlineOperatorsStore } from "../../src/modules/monitor/online-operators.store.js";

describe("OnlineOperatorsStore", () => {
  it("markOnline registra o operador; listOnline devolve id e nome", () => {
    const store = new OnlineOperatorsStore();

    store.markOnline("op-1", "Operador Um");

    expect(store.listOnline()).toEqual([{ operatorId: "op-1", displayName: "Operador Um" }]);
  });

  it("markOffline remove o operador da lista", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-1", "Operador Um");

    store.markOffline("op-1");

    expect(store.listOnline()).toEqual([]);
  });

  it("markOffline de um operador que não está online não quebra", () => {
    const store = new OnlineOperatorsStore();

    expect(() => store.markOffline("nao-existe")).not.toThrow();
    expect(store.listOnline()).toEqual([]);
  });

  it("touch atualiza o lastSeen de um operador já online, sem duplicar", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-1", "Operador Um", 1000);

    store.touch("op-1", "Operador Um", 5000);

    expect(store.listOnline()).toEqual([{ operatorId: "op-1", displayName: "Operador Um" }]);
  });

  it("touch de um operador desconhecido faz self-heal: marca como online (ex.: depois de um restart do servidor)", () => {
    const store = new OnlineOperatorsStore();

    store.touch("op-novo", "Operador Novo", 1000);

    expect(store.listOnline()).toEqual([{ operatorId: "op-novo", displayName: "Operador Novo" }]);
  });

  it("sweepStale remove e devolve operadores sem heartbeat há mais que o timeout", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-fresco", "Fresco", 100_000);
    store.markOnline("op-velho", "Velho", 0);

    const stale = store.sweepStale(60_000, 100_000);

    expect(stale).toEqual(["op-velho"]);
    expect(store.listOnline()).toEqual([{ operatorId: "op-fresco", displayName: "Fresco" }]);
  });

  it("sweepStale não remove ninguém quando todos estão dentro do timeout", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-1", "Um", 50_000);

    const stale = store.sweepStale(60_000, 100_000);

    expect(stale).toEqual([]);
    expect(store.listOnline()).toHaveLength(1);
  });

  it("clear remove todos os operadores (usado só pra isolar testes que compartilham o singleton)", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-1", "Um");
    store.markOnline("op-2", "Dois");

    store.clear();

    expect(store.listOnline()).toEqual([]);
  });

  it("markOnline de novo pra um operador já online atualiza o lastSeen (não duplica)", () => {
    const store = new OnlineOperatorsStore();
    store.markOnline("op-1", "Um", 1000);

    store.markOnline("op-1", "Um", 90_000);

    const stale = store.sweepStale(60_000, 100_000);
    expect(stale).toEqual([]);
  });
});
