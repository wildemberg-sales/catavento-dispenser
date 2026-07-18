import { useEffect } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import type { PendingAction, PendingActionsQueue } from "./pendingActionsQueue";

type NetInfoLike = Parameters<typeof useNetworkStatus>[0];

export function usePendingActionsSync(deps: {
  pendingActionsQueue: PendingActionsQueue;
  sendAction: (action: PendingAction) => Promise<void>;
  netInfo?: NetInfoLike;
}) {
  const isConnected = useNetworkStatus(deps.netInfo);

  useEffect(() => {
    if (isConnected) {
      void deps.pendingActionsQueue.drain(deps.sendAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);
}
