import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AnimatedMeshGradient } from '@/components/ui/MeshGradient';
import Constants from 'expo-constants';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';

const C = {
  bg: '#F5F0ED',
  white: '#FFFFFF',
  sheet: 'rgba(255, 255, 255, 0.88)',
  sheetBorder: 'rgba(0, 0, 0, 0.06)',
  buttonLight: '#1A1A1E',
  buttonDark: 'rgba(255, 255, 255, 0.72)',
  buttonBorder: 'rgba(0, 0, 0, 0.08)',
  textDark: '#F4F4F8',
  textLight: '#1A1A1E',
  headline: '#1A1A1E',
};

const ENTRY_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

// ── Mesh gradient colors (warm beige / terracotta / gold / cream) ──
const MESH_COLORS = [
  { r: 0.96, g: 0.94, b: 0.91 },  // warm cream
  { r: 0.78, g: 0.43, b: 0.31 },  // terracotta
  { r: 0.83, g: 0.69, b: 0.22 },  // gold
  { r: 0.95, g: 0.91, b: 0.87 },  // light beige
];

// ── Typewriter phrases ──
const PHRASES = [
  'Save any recipe',
  'Scan your fridge',
  'Plan your meals',
  'Cook hands-free',
  'Share with friends',
];
const TYPE_SPEED = 70;
const DELETE_SPEED = 40;
const PAUSE_AFTER_TYPE = 2200;
const PAUSE_AFTER_DELETE = 400;

function useTypewriter(phrases: string[]) {
  const [display, setDisplay] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const idx = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(() => {
    const phrase = phrases[idx.current];
    let charPos = 0;
    let isDeleting = false;

    const tick = () => {
      if (!isDeleting) {
        charPos++;
        setDisplay(phrase.slice(0, charPos));
        if (charPos === phrase.length) {
          isDeleting = true;
          timeout.current = setTimeout(tick, PAUSE_AFTER_TYPE);
        } else {
          timeout.current = setTimeout(tick, TYPE_SPEED);
        }
      } else {
        charPos--;
        setDisplay(phrase.slice(0, charPos));
        if (charPos === 0) {
          idx.current = (idx.current + 1) % phrases.length;
          timeout.current = setTimeout(run, PAUSE_AFTER_DELETE);
        } else {
          timeout.current = setTimeout(tick, DELETE_SPEED);
        }
      }
    };

    tick();
  }, [phrases]);

  useEffect(() => {
    // small initial delay before starting
    timeout.current = setTimeout(run, 600);
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [run]);

  // Blinking cursor
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  return { display, cursorVisible };
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithApple, signInWithGoogle, isLoading } = useAuthStore();
  const { display, cursorVisible } = useTypewriter(PHRASES);
  const appleRequestInFlightRef = useRef(false);
  const [isAppleRequestInFlight, setIsAppleRequestInFlight] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';
  const isAppleBusy = isLoading || isAppleRequestInFlight;

  const headlineOpacity = useSharedValue(0);
  const headlineY = useSharedValue(14);
  const sheetY = useSharedValue(400);
  const actionsOpacity = useSharedValue(0);

  useEffect(() => {
    headlineOpacity.value = withDelay(300, withTiming(1, { duration: 360, easing: ENTRY_EASE }));
    headlineY.value = withDelay(300, withTiming(0, { duration: 360, easing: ENTRY_EASE }));

    sheetY.value = withDelay(500, withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }));
    actionsOpacity.value = withDelay(700, withTiming(1, { duration: 400, easing: ENTRY_EASE }));
  }, []);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineY.value }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
  }));

  const handleApple = async () => {
    if (isLoading || appleRequestInFlightRef.current) return;
    if (Platform.OS !== 'ios') {
      Alert.alert('iOS Only', 'Apple Sign In is only available on iOS devices.');
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        'Use Development or TestFlight Build',
        'Apple Sign In is not supported in Expo Go for this app. Open the app from an EAS development build or TestFlight.'
      );
      return;
    }

    appleRequestInFlightRef.current = true;
    setIsAppleRequestInFlight(true);

    try {
      const result = await signInWithApple();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace(result?.isNewUser ? '/onboarding' : '/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Apple sign in failed');
    } finally {
      appleRequestInFlightRef.current = false;
      setIsAppleRequestInFlight(false);
    }
  };

  const handleGoogle = async () => {
    if (isLoading) return;
    try {
      const result = await signInWithGoogle();
      router.replace(result?.isNewUser ? '/onboarding' : '/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Google sign in failed');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Animated mesh gradient background */}
      <AnimatedMeshGradient
        colors={MESH_COLORS}
        speed={0.8}
        noise={0.12}
        blur={0.5}
        contrast={0.9}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle logo watermark — behind the fade overlay */}
      <View style={styles.logoContainer} pointerEvents="none">
        <Image
          source={require('@/assets/logo.png')}
          style={styles.logoWatermark}
        />
      </View>

      {/* Fade overlay — fades out the logo + gradient in the lower half */}
      <LinearGradient
        colors={[
          'rgba(245, 240, 237, 0)',
          'rgba(245, 240, 237, 0.6)',
          'rgba(245, 240, 237, 5)',
          'rgba(245, 240, 237, 1)',
        ]}
        locations={[0, 0.4, 0.58, 0.72]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Center headline */}
      <View style={styles.centerStage} pointerEvents="none">
        <Animated.View style={[styles.headlineRow, headlineStyle]}>
          <Text style={styles.headline}>
            {display}
            <Text style={[styles.cursor, !cursorVisible && styles.cursorHidden]}>|</Text>
          </Text>
        </Animated.View>
        <Animated.View style={[styles.headlineRow, headlineStyle]}>
          <Text style={styles.subtitle}>with EITO</Text>
        </Animated.View>
      </View>

      {/* Bottom sheet — slides up from bottom */}
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          { paddingBottom: Math.max(insets.bottom + 16, 26) },
        ]}
      >
        <BlurView
          intensity={60}
          tint="light"
          style={[StyleSheet.absoluteFill, styles.sheetBg]}
        />
        <View style={[styles.sheetOverlay, styles.sheetBg]} pointerEvents="none" />
        <Animated.View style={[styles.sheetContent, actionsStyle]}>
          {/* Continue with Apple */}
          <Pressable
            style={({ pressed }) => [
              styles.mainButton,
              styles.appleButton,
              pressed && styles.pressed,
              (isAppleBusy || isExpoGo) && styles.disabled,
            ]}
            onPress={handleApple}
            disabled={isAppleBusy || isExpoGo}
          >
            {isAppleBusy ? (
              <>
                <ActivityIndicator size="small" color={C.textDark} />
                <Text style={styles.appleText}>Signing in...</Text>
              </>
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color={C.textDark} />
                <Text style={styles.appleText}>Continue with Apple</Text>
              </>
            )}
          </Pressable>

          {/* Continue with Google */}
          <Pressable
            style={({ pressed }) => [
              styles.mainButton,
              styles.googleButton,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
            onPress={handleGoogle}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color={C.textLight} />
                <Text style={styles.googleText}>Signing in...</Text>
              </>
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={C.textLight} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {/* Sign up */}
          <Pressable
            style={({ pressed }) => [
              styles.mainButton,
              styles.darkButton,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
            onPress={() => router.push('/auth?mode=signup')}
            disabled={isLoading}
          >
            <Text style={styles.lightText}>Sign up</Text>
          </Pressable>

          {/* Log in link */}
          <Pressable
            style={({ pressed }) => [
              styles.loginRow,
              pressed && { opacity: 0.6 },
              isLoading && styles.disabled,
            ]}
            onPress={() => router.push('/auth')}
            disabled={isLoading}
          >
            <Text style={styles.loginHint}>Already have an account? </Text>
            <Text style={styles.loginLink}>Log in</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  logoContainer: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    alignItems: 'center',
    overflow: 'visible',
  },
  logoWatermark: {
    width: 1000,
    height: 1000,
    opacity: 0.10,
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 34,
    color: C.headline,
    letterSpacing: -0.6,
    minHeight: 44,
  },
  cursor: {
    fontFamily: 'PlusJakartaSans_300Light',
    fontWeight: '300',
    color: '#C66E4E',
  },
  cursorHidden: {
    opacity: 0,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 34,
    color: '#C66E4E',
    letterSpacing: -0.6,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  sheetBg: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sheetContent: {
    gap: 10,
  },
  mainButton: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  appleButton: {
    backgroundColor: C.buttonLight,
  },
  googleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  darkButton: {
    backgroundColor: C.buttonDark,
  },
  appleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.textDark,
  },
  googleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.textLight,
  },
  lightText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.textLight,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  loginHint: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: 'rgba(26, 26, 30, 0.45)',
  },
  loginLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#C66E4E',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
