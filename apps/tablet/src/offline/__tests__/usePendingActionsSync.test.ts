import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePendingActionsSync } from "../usePendingActionsSync";

describe("usePendingActionsSync", () => {
  it("drena a fila pendente quando conectado", async () => {
    let emit: (isConnected: boolean) => void = () => {};
    const netInfo = {
      addEventListener: jest.fn((listener: (state: { isConnected: boolean | null }) => void) => {
        emit = (isConnected: boolean) => listener({ isConnected });
        return jest.fn();
      }),
    };
    const drain = jest.fn().mockResolvedValue(undefined);
    const pendingActionsQueue = { drain } as unknown as Parameters<typeof usePendingActionsSync>[0]["pendingActionsQueue"];
    const sendAction = jest.fn().mockResolvedValue(undefined);

    await renderHook(() => usePendingActionsSync({ pendingActionsQueue, sendAction, netInfo }));

    await act(() => emit(true));
    await waitFor(() => expect(drain).toHaveBeenCalledWith(sendAction));
  });

  it("não tenta drenar enquanto estiver desconectado", async () => {
    let emit: (isConnected: boolean) => void = () => {};
    const netInfo = {
      addEventListener: jest.fn((listener: (state: { isConnected: boolean | null }) => void) => {
        emit = (isConnected: boolean) => listener({ isConnected });
        return jest.fn();
      }),
    };
    const drain = jest.fn().mockResolvedValue(undefined);
    const pendingActionsQueue = { drain } as unknown as Parameters<typeof usePendingActionsSync>[0]["pendingActionsQueue"];
    const sendAction = jest.fn().mockResolvedValue(undefined);

    await renderHook(() => usePendingActionsSync({ pendingActionsQueue, sendAction, netInfo }));

    await act(() => emit(false));
    expect(drain).not.toHaveBeenCalled();
  });
});
