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
  const { updateProfile } = useAuthStore();

  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const closeScreen = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!isAvailable || isSaving || validationError) return;

    setIsSaving(true);
    try {
      await userService.setUsername(username);
      await updateProfile({ username: username.toLowerCase().trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeScreen();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setValidationError(error.message || 'Failed to set username');
    } finally {
      setIsSaving(false);
    }
  }, [username, isAvailable, isSaving, validationError, updateProfile, closeScreen]);

  const handleSkip = useCallback(() => {
    closeScreen();
  }, [closeScreen]);

  const getStatusIcon = () => {
    if (isChecking) {
      return <ActivityIndicator size="small" color="#B5B0A7" />;
    }
    if (validationError) {
      return <Ionicons name="close-circle" size={22} color="#EF4444" />;
    }
    if (isAvailable === true) {
      return <Ionicons name="checkmark-circle" size={22} color="#D4AF37" />;
    }
    if (isAvailable === false) {
      return <Ionicons name="close-circle" size={22} color="#EF4444" />;
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
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Username</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.subtitle}>
            This is how others will find and mention you
          </Text>

          <View style={styles.inputWrap}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#D5D1CB"
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
                styles.statusMsg,
                isAvailable === true && styles.statusSuccess,
                (validationError || isAvailable === false) && styles.statusError,
              ]}
            >
              {getStatusMessage()}
            </Text>
          ) : null}

          <View style={styles.rules}>
            <Text style={styles.rulesLabel}>Requirements</Text>
            <View style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>3–20 characters</Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>Letters, numbers, and underscores</Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>Must start with a letter</Text>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    flex: 1,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#8A8578',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1A1510',
  },
  saveBtn: {
    backgroundColor: '#C66E4E',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  saveBtnTextDisabled: {
    color: '#B5B0A7',
  },

  // ── Form ──
  form: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: '#1A1510',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#B5B0A7',
    textAlign: 'center',
    marginBottom: 36,
  },

  // ── Input ──
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  atSymbol: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    color: '#C66E4E',
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 56,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 18,
    color: '#1A1510',
  },
  statusIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Status ──
  statusMsg: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    color: '#B5B0A7',
  },
  statusSuccess: {
    color: '#D4AF37',
  },
  statusError: {
    color: '#EF4444',
  },

  // ── Rules ──
  rules: {
    marginTop: 36,
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  rulesLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#B5B0A7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5D1CB',
  },
  ruleText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8A8578',
  },
});
