import { EventEmitter } from "node:events";

export type MonitorEvent =
  | { type: "item_assigned"; payload: { queueItemId: string; operatorId: string; queueSize: number } }
  | { type: "item_completed"; payload: { queueItemId: string; operatorId: string; outcome: string } }
  | { type: "operator_online"; payload: { operatorId: string } }
  | { type: "operator_offline"; payload: { operatorId: string } }
  | { type: "queue_size_changed"; payload: { queueSize: number } };

// Só existe uma estação de gerência (Seção 9.1) — um EventEmitter interno
// in-process é suficiente, sem necessidade de pub/sub distribuído (Redis).
export class MonitorBus extends EventEmitter {
  publish(event: MonitorEvent): void {
    this.emit("event", event);
  }

  subscribe(listener: (event: MonitorEvent) => void): () => void {
    this.on("event", listener);
    return () => this.off("event", listener);
  }
}

export const monitorBus = new MonitorBus();
