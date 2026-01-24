import { View, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCoxBsywBe-w6v3I8KuCIcXGgrzg7ui9Yp-xMLJwSF0wJRAGm7kzKaluE5PDq8PQZZMsYuQDadosLE11Jg3YulTd8kHfAP6vOGvzsthc1jiIE9eSr9pOFMiUFfaVKhBohjeDCwVLZ7cKQCn229bQF0-yAN96ICN498PMBio-5doKvNpLKcBg9rI4jybBGdGFw26TUmfLyC0U_vF93IlLHpyvmJAzBRJFa7B-GoQRSjEDkvIvVpn1sc_VzgTS7nfr1vPk8WNKfJA9lc';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.background}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayBottom} />
        <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.centerBlock}>
            <View style={styles.logoShell}>
              <Ionicons name="restaurant" size={32} color="#F2330D" />
            </View>
            <Text style={styles.title}>Recipe App</Text>
            <Text style={styles.subtitle}>
              Turn videos into delicious recipes instantly with AI magic.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#141B0D" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/auth')}
              activeOpacity={0.9}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms & Privacy Policy.
            </Text>
          </View>
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
  overlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 44,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    color: '#E1E5D5',
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    gap: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  terms: {
    color: '#9C9C9C',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'NotoSans_500Medium',
    marginTop: 6,
  },
});
