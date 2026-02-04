import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/stores/authStore';

export default function SetupUsernameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuthStore();

  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced availability check
  useEffect(() => {
    if (!username.trim()) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

    const validation = userService.validateUsername(username);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid username');
      setIsAvailable(null);
      return;
    }

    setValidationError(null);
    setIsChecking(true);

    const timer = setTimeout(async () => {
      try {
        const available = await userService.isUsernameAvailable(username);
        setIsAvailable(available);
      } catch (error) {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSave = useCallback(async () => {
    if (!isAvailable || isSaving || validationError) return;

    setIsSaving(true);
    try {
      await userService.setUsername(username);
      await updateProfile({ username: username.toLowerCase().trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setValidationError(error.message || 'Failed to set username');
    } finally {
      setIsSaving(false);
    }
  }, [username, isAvailable, isSaving, validationError, updateProfile, router]);

  const getStatusIcon = () => {
    if (isChecking) {
      return <ActivityIndicator size="small" color="#9C5749" />;
    }
    if (validationError) {
      return <Ionicons name="close-circle" size={24} color="#F44336" />;
    }
    if (isAvailable === true) {
      return <Ionicons name="checkmark-circle" size={24} color="#22C55E" />;
    }
    if (isAvailable === false) {
      return <Ionicons name="close-circle" size={24} color="#F44336" />;
    }
    return null;
  };

  const getStatusMessage = () => {
    if (validationError) return validationError;
    if (isAvailable === false) return 'Username is already taken';
    if (isAvailable === true) return 'Username is available!';
    return '';
  };

  const canSave = isAvailable === true && !isSaving && !validationError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="#1C100D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Username</Text>
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.formContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="at" size={48} color="#F2330D" />
          </View>

          <Text style={styles.title}>Pick a unique username</Text>
          <Text style={styles.subtitle}>
            This is how other users will find and mention you
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#C8B7B2"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
            />
            <View style={styles.statusIcon}>{getStatusIcon()}</View>
          </View>

          {getStatusMessage() ? (
            <Text
              style={[
                styles.statusMessage,
                isAvailable === true && styles.statusMessageSuccess,
                (validationError || isAvailable === false) && styles.statusMessageError,
              ]}
            >
              {getStatusMessage()}
            </Text>
          ) : null}

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Username rules:</Text>
            <Text style={styles.ruleItem}>• 3-20 characters</Text>
            <Text style={styles.ruleItem}>• Letters, numbers, and underscores only</Text>
            <Text style={styles.ruleItem}>• Must start with a letter</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  saveButton: {
    backgroundColor: '#F2330D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#E8D3CE',
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#9C5749',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  atSymbol: {
    fontSize: 20,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 18,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  statusIcon: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMessage: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
    marginTop: 12,
  },
  statusMessageSuccess: {
    color: '#22C55E',
  },
  statusMessageError: {
    color: '#F44336',
  },
  rules: {
    marginTop: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rulesTitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    marginBottom: 8,
  },
  ruleItem: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginBottom: 4,
  },
});
