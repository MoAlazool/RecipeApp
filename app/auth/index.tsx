import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { firebaseService } from '@/services/firebase.service';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { FormInput } from '@/components/auth/FormInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { signIn, signUp, signInWithGoogle, isLoading, clearError } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(params.mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation states - only show after user has typed
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    fullName: false,
  });

  // Validation logic
  const validation = useMemo(() => {
    const emailValid = EMAIL_REGEX.test(email.trim());
    const passwordValid = password.length >= 6;
    const nameValid = fullName.trim().length >= 2;

    return {
      email: {
        isValid: emailValid,
        error: touched.email && email.length > 0 && !emailValid
          ? 'Please enter a valid email address'
          : undefined,
      },
      password: {
        isValid: passwordValid,
        error: touched.password && password.length > 0 && !passwordValid
          ? 'Password must be at least 6 characters'
          : undefined,
      },
      fullName: {
        isValid: nameValid,
        error: touched.fullName && fullName.length > 0 && !nameValid
          ? 'Name must be at least 2 characters'
          : undefined,
      },
    };
  }, [email, password, fullName, touched]);

  const isFormValid = useMemo(() => {
    if (isSignUp) {
      return validation.email.isValid && validation.password.isValid && validation.fullName.isValid;
    }
    return validation.email.isValid && validation.password.isValid;
  }, [isSignUp, validation]);

  const handleSubmit = async () => {
    // Mark all fields as touched to show any remaining errors
    setTouched({ email: true, password: true, fullName: true });

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim() || undefined);
      } else {
        await signIn(email.trim(), password);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validation.email.isValid) {
      setTouched(prev => ({ ...prev, email: true }));
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await firebaseService.resetPassword(email.trim());
      setResetEmailSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setShowForgotPassword(false);
    setResetEmailSent(false);
    clearError();
    setTouched({ email: false, password: false, fullName: false });
  };

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#1C100D" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="key" size={32} color="#FFF" />
            </View>
            <Text h2 style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {resetEmailSent
                ? "We've sent you an email with instructions to reset your password."
                : "Enter your email and we'll send you a link to reset your password."}
            </Text>
          </View>

          {!resetEmailSent ? (
            <View style={styles.form}>
              <FormInput
                placeholder="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (!touched.email) setTouched(prev => ({ ...prev, email: true }));
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon="mail-outline"
                error={validation.email.error}
                isValid={validation.email.isValid}
              />

              <PrimaryButton
                title="Send Reset Link"
                onPress={handleForgotPassword}
                loading={isSubmitting}
                disabled={!validation.email.isValid}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
              </View>
              <Text style={styles.successText}>Check your inbox!</Text>
              <PrimaryButton
                title="Back to Sign In"
                onPress={() => {
                  setShowForgotPassword(false);
                  setResetEmailSent(false);
                }}
                variant="outline"
                style={{ marginTop: 24 }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LoadingOverlay visible={isLoading} message="Please wait..." />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="restaurant" size={32} color="#FFF" />
          </View>
          <Text h2 style={styles.title}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Sign up to save your recipes and sync across devices'
              : 'Sign in to access your recipes'}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp && (
            <FormInput
              placeholder="Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (!touched.fullName) setTouched(prev => ({ ...prev, fullName: true }));
              }}
              autoCapitalize="words"
              leftIcon="person-outline"
              error={validation.fullName.error}
              isValid={validation.fullName.isValid}
            />
          )}

          <FormInput
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (!touched.email) setTouched(prev => ({ ...prev, email: true }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon="mail-outline"
            error={validation.email.error}
            isValid={validation.email.isValid}
          />

          <FormInput
            placeholder="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (!touched.password) setTouched(prev => ({ ...prev, password: true }));
            }}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            error={validation.password.error}
            isValid={validation.password.isValid}
          />

          {!isSignUp && (
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => setShowForgotPassword(true)}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <PrimaryButton
            title={isSignUp ? 'Create Account' : 'Sign In'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!isFormValid}
            style={{ marginTop: isSignUp ? 8 : 0 }}
          />

          <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => Alert.alert('Coming Soon', 'Apple Sign In coming soon!')}
          >
            <Ionicons name="logo-apple" size={24} color="#1C100D" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={async () => {
              try {
                await signInWithGoogle();
                router.replace('/(tabs)');
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Google sign in failed');
              }
            }}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 240,
    height: 200,
    borderRadius: 120,
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -160,
    right: -120,
    width: 260,
    height: 220,
    borderRadius: 130,
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F2330D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#F2330D',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: '#1C100D',
    marginBottom: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  subtitle: {
    color: '#9C5749',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'NotoSans_500Medium',
    maxWidth: 300,
  },
  form: {
    marginBottom: 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#F2330D',
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  toggleText: {
    color: '#9C5749',
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
  },
  toggleTextBold: {
    color: '#F2330D',
    fontFamily: 'NotoSans_700Bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8D3CE',
  },
  dividerText: {
    color: '#9C5749',
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  terms: {
    textAlign: 'center',
    color: '#C8B7B2',
    fontSize: 12,
    marginTop: 32,
    lineHeight: 18,
    fontFamily: 'NotoSans_500Medium',
  },
});
