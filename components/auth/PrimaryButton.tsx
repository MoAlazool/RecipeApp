import { StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import { Text } from '@rneui/themed';

const C = {
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  white: '#FFFFFF',
  muted: '#8A8578',
};

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'outline' && styles.buttonOutline,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && { opacity: 0.88, transform: [{ scale: 0.985 }] },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? C.white : C.charcoal}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'primary' && styles.textPrimary,
            variant === 'secondary' && styles.textSecondary,
            variant === 'outline' && styles.textOutline,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: C.charcoal,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  textPrimary: {
    color: C.white,
  },
  textSecondary: {
    color: C.charcoal,
  },
  textOutline: {
    color: C.charcoal,
  },
});
