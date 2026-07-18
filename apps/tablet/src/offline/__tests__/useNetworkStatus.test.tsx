import React from "react";
import { Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { useNetworkStatus } from "../useNetworkStatus";

function TestConsumer({ netInfo }: { netInfo: Parameters<typeof useNetworkStatus>[0] }) {
  const isConnected = useNetworkStatus(netInfo);
  return <Text testID="status">{String(isConnected)}</Text>;
}

describe("useNetworkStatus", () => {
  it("reflete o estado de conexão emitido pelo NetInfo e atualiza em mudanças", async () => {
    let emit: (isConnected: boolean) => void = () => {};
    const netInfo = {
      addEventListener: jest.fn((listener: (state: { isConnected: boolean | null }) => void) => {
        emit = (isConnected: boolean) => listener({ isConnected });
        return jest.fn();
      }),
    };

    await render(<TestConsumer netInfo={netInfo} />);

    await act(() => emit(false));
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("false"));

    await act(() => emit(true));
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("true"));
  });

  it("cancela a inscrição ao desmontar", async () => {
    const unsubscribe = jest.fn();
    const netInfo = { addEventListener: jest.fn().mockReturnValue(unsubscribe) };

    const { unmount } = await render(<TestConsumer netInfo={netInfo} />);
    await unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
