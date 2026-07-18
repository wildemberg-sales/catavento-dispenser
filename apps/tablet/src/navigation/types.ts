import type { QueueItemDTO } from "@catavento/contracts/queue";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Item: { item: QueueItemDTO };
};
