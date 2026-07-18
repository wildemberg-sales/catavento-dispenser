import { useEffect, useState } from "react";
import DefaultNetInfo from "@react-native-community/netinfo";

type NetInfoLike = {
  addEventListener: (listener: (state: { isConnected: boolean | null }) => void) => () => void;
};

export function useNetworkStatus(netInfo: NetInfoLike = DefaultNetInfo): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = netInfo.addEventListener((state) => setIsConnected(state.isConnected));
    return unsubscribe;
  }, [netInfo]);

  return isConnected;
}
