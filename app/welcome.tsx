import { useEffect } from 'react';
import { View, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  FadeInUp,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCoxBsywBe-w6v3I8KuCIcXGgrzg7ui9Yp-xMLJwSF0wJRAGm7kzKaluE5PDq8PQZZMsYuQDadosLE11Jg3YulTd8kHfAP6vOGvzsthc1jiIE9eSr9pOFMiUFfaVKhBohjeDCwVLZ7cKQCn229bQF0-yAN96ICN498PMBio-5doKvNpLKcBg9rI4jybBGdGFw26TUmfLyC0U_vF93IlLHpyvmJAzBRJFa7B-GoQRSjEDkvIvVpn1sc_VzgTS7nfr1vPk8WNKfJA9lc';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animation values
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(-30);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const shimmerPosition = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Logo entrance animation
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    logoRotate.value = withDelay(200, withSpring(0, { damping: 15 }));

    // Title animation
    titleOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(500, withSpring(0, { damping: 12 }));

    // Subtitle animation
    subtitleOpacity.value = withDelay(800, withTiming(1, { duration: 600 }));

    // Button animation
    buttonScale.value = withDelay(1100, withSpring(1, { damping: 10 }));
    buttonOpacity.value = withDelay(1100, withTiming(1, { duration: 400 }));

    // Shimmer animation (continuous)
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );

    // Pulse animation for logo
    pulseScale.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value * pulseScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmerPosition.value, [0, 1], [-200, 200]),
      },
    ],
    opacity: interpolate(shimmerPosition.value, [0, 0.5, 1], [0, 0.6, 0]),
  }));

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.background}>
        {/* Gradient overlays */}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(28,16,13,0.95)']}
          locations={[0.35, 0.85]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.centerBlock}>
            {/* Animated Logo */}
            <Animated.View style={[styles.logoShell, logoStyle]}>
              <View style={styles.logoInner}>
                <Ionicons name="restaurant" size={32} color="#F2330D" />
              </View>
              {/* Shimmer effect */}
              <Animated.View style={[styles.shimmer, shimmerStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Animated.View>

            {/* Title */}
            <Animated.View style={titleStyle}>
              <Text style={styles.title}>Recipe App</Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View style={subtitleStyle}>
              <Text style={styles.subtitle}>
                Turn videos into delicious recipes instantly with AI magic.
              </Text>
            </Animated.View>

            {/* Feature pills */}
            <Animated.View
              entering={FadeInUp.delay(1200).duration(600)}
              style={styles.featurePills}
            >
              <View style={styles.featurePill}>
                <Ionicons name="videocam" size={14} color="#F2330D" />
                <Text style={styles.featurePillText}>Video to Recipe</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="camera" size={14} color="#F2330D" />
                <Text style={styles.featurePillText}>Scan Fridge</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="mic" size={14} color="#F2330D" />
                <Text style={styles.featurePillText}>Voice Cook</Text>
              </View>
            </Animated.View>
          </View>

          <Animated.View style={[styles.actions, buttonStyle]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#F2330D', '#E02D0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <View style={styles.arrowCircle}>
                  <Ionicons name="arrow-forward" size={16} color="#F2330D" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/auth')}
              activeOpacity={0.9}
            >
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </TouchableOpacity>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms & Privacy Policy.
            </Text>
          </Animated.View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#221310',
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  logoShell: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    left: -100,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 48,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 17,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featurePillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
  },
  actions: {
    width: '100%',
    gap: 14,
  },
  primaryButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  terms: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'NotoSans_500Medium',
    marginTop: 8,
  },
});
