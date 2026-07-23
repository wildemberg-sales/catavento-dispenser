import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider baseUrl={API_BASE_URL}>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
