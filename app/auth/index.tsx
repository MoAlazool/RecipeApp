import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedMeshGradient } from '@/components/ui/MeshGradient';
import { useAuthStore } from '@/stores/authStore';
import { firebaseService } from '@/services/firebase.service';
import { FormInput } from '@/components/auth/FormInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

const MESH_COLORS = [
  { r: 0.96, g: 0.94, b: 0.91 },
  { r: 0.78, g: 0.43, b: 0.31 },
  { r: 0.83, g: 0.69, b: 0.22 },
  { r: 0.95, g: 0.91, b: 0.87 },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { signIn, signUp, isLoading, clearError } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(params.mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    fullName: false,
  });

  const validation = useMemo(() => {
    const emailValid = EMAIL_REGEX.test(email.trim());
    const passwordValid = password.length >= 6;
    const nameValid = fullName.trim().length >= 2;

    return {
      email: {
        isValid: emailValid,
        error:
          touched.email && email.length > 0 && !emailValid
            ? 'Please enter a valid email'
            : undefined,
      },
      password: {
        isValid: passwordValid,
        error:
          touched.password && password.length > 0 && !passwordValid
            ? 'At least 6 characters'
            : undefined,
      },
      fullName: {
        isValid: nameValid,
        error:
          touched.fullName && fullName.length > 0 && !nameValid
            ? 'At least 2 characters'
            : undefined,
      },
    };
  }, [email, password, fullName, touched]);

  const isFormValid = useMemo(() => {
    if (isSignUp) {
      return (
        validation.email.isValid &&
        validation.password.isValid &&
        validation.fullName.isValid
      );
    }
    return validation.email.isValid && validation.password.isValid;
  }, [isSignUp, validation]);

  const handleSubmit = async () => {
    setTouched({ email: true, password: true, fullName: true });
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim() || undefined);
        router.replace('/onboarding');
      } else {
        await signIn(email.trim(), password);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validation.email.isValid) {
      setTouched((prev) => ({ ...prev, email: true }));
      Alert.alert('Enter your email', 'Type your email address first, then tap reset.');
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

  // ── Forgot Password ──
  if (showForgotPassword) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AnimatedMeshGradient
          colors={MESH_COLORS}
          speed={0.6}
          noise={0.1}
          blur={0.5}
          contrast={0.85}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(250,247,242,0.95)', 'rgba(250,247,242,0.75)', 'rgba(250,247,242,0.3)']}
          locations={[0.4, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={C.charcoal} />
          </Pressable>

          <View style={styles.headingBlock}>
            <Text style={styles.heading}>Reset password</Text>
            <Text style={styles.subheading}>
              {resetEmailSent
                ? "Check your inbox — we've sent you a reset link."
                : "Enter your email and we'll send a reset link."}
            </Text>
          </View>

          {!resetEmailSent ? (
            <View style={styles.formCard}>
              <FormInput
                placeholder="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (!touched.email)
                    setTouched((prev) => ({ ...prev, email: true }));
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon="mail-outline"
                error={validation.email.error}
                isValid={validation.email.isValid}
              />

              <PrimaryButton
                title="Send reset link"
                onPress={handleForgotPassword}
                loading={isSubmitting}
                disabled={!validation.email.isValid}
                style={{ marginTop: 4 }}
              />
            </View>
          ) : (
            <View style={styles.formCard}>
              <View style={styles.successRow}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={24} color={C.card} />
                </View>
                <Text style={styles.successText}>Email sent!</Text>
              </View>

              <PrimaryButton
                title="Back to sign in"
                onPress={() => {
                  setShowForgotPassword(false);
                  setResetEmailSent(false);
                }}
                variant="outline"
                style={{ marginTop: 8 }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main Auth Screen ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AnimatedMeshGradient
        colors={MESH_COLORS}
        speed={0.6}
        noise={0.1}
        blur={0.5}
        contrast={0.85}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(250,247,242,0.3)', 'rgba(250,247,242,0.75)', 'rgba(250,247,242,0.95)']}
        locations={[0, 0.35, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </Pressable>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>
            {isSignUp ? 'Create account' : 'Welcome back'}
          </Text>
          <Text style={styles.subheading}>
            {isSignUp
              ? 'Sign up to save and sync your recipes'
              : 'Sign in to your account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          {isSignUp && (
            <FormInput
              placeholder="Full name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (!touched.fullName)
                  setTouched((prev) => ({ ...prev, fullName: true }));
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
              if (!touched.email)
                setTouched((prev) => ({ ...prev, email: true }));
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
              if (!touched.password)
                setTouched((prev) => ({ ...prev, password: true }));
            }}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            error={validation.password.error}
            isValid={validation.password.isValid}
          />

          {!isSignUp && (
            <Pressable
              style={styles.forgotBtn}
              onPress={() => setShowForgotPassword(true)}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          <PrimaryButton
            title={isSignUp ? 'Create account' : 'Sign in'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!isFormValid}
            style={{ marginTop: isSignUp ? 8 : 0 }}
          />
        </View>

        {/* Toggle mode */}
        <Pressable
          style={styles.toggleRow}
          onPress={toggleMode}
        >
          <Text style={styles.toggleHint}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <Text style={styles.toggleLink}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </Text>
        </Pressable>

        {/* Terms */}
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
    backgroundColor: C.bg,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headingBlock: {
    marginBottom: 28,
    paddingHorizontal: 2,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: C.charcoal,
    marginBottom: 8,
  },
  subheading: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.muted,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    marginTop: -2,
  },
  forgotText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.terracotta,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  toggleHint: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },
  toggleLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: C.terracotta,
  },
  terms: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: 'rgba(138, 133, 120, 0.6)',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  successRow: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: C.charcoal,
  },
});
