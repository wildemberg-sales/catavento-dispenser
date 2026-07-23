import React, { useState } from "react";
import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const backgroundColor = variant === "primary" ? colors.primary : colors.secondary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[
        styles.button,
        variant === "primary" ? styles.shadow : null,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  shadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    ...typography.button,
    color: colors.textOnDark,
  },
});
