import { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  error: '#EF4444',
};

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  isValid?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function FormInput({
  label,
  error,
  isValid,
  leftIcon,
  rightIcon,
  onRightIconPress,
  value,
  ...props
}: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error && styles.inputWrapperError,
          isValid && hasValue && !error && styles.inputWrapperValid,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={error ? C.error : isFocused ? C.terracotta : C.muted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={styles.input}
          placeholderTextColor={C.muted}
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconButton}>
            <Ionicons name={rightIcon} size={18} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.errorSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 16,
    backgroundColor: C.card,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: C.terracotta,
  },
  inputWrapperError: {
    borderColor: C.error,
  },
  inputWrapperValid: {
    borderColor: 'rgba(26, 21, 16, 0.15)',
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    paddingVertical: 14,
  },
  rightIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.error,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorSpacer: {
    height: 6,
  },
});
