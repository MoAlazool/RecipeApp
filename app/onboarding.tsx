import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Save recipes instantly',
    description: 'Paste a video link and we will turn it into a recipe you can cook.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC1L9Gpi_6o-9VXRmE1r8-0qxseGl0g4e0EQH9rSMy8w8ON6KXxRUDNh2gQL8Z8V1S2Mta9pX5yBAO6Q6fgeSKt4XlHnYkNLf9CHG8KqPNsC7DhobDV69Z46rZn0_7Yi4NnLkK3A0g2FKB3FWx0E9I7kBtbStAHt8r0RoTWpSt-yI8v-uWdpN0GVYJ6C52b2ipR2zQ4sC2xvXfzAyTAp0fI4o6x73K0nTi6FG8NB49eI29K1h7yQyL5Lx8h6M3U',
  },
  {
    title: 'Scan your fridge',
    description: 'Snap a photo of ingredients and get recipe ideas in seconds.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCQXTwapaniAOk1movnc4cmLxZuo_z5GjdWlrDqGjs8so64CmUGxtSOkw8mzsZt7TPtJnYLu-GwLJs7xKGr5Hdx3p5i38QZ5OQacOYkbQAFwp2QdYOrdQOUeshwn7LMglNz_NOXaEzAQ0fkS4KX13rR8TRCMmAsgLjxszFbnfv4eAPxuyXIAOqpkCjUNpx0_G2iBIPosulMdVWdPEXWMBMXCKc98WPVxgKwQPjIXLfPIxkjoo5g5FQT95Qmp81RuZqk0jAjKeYBiG4',
  },
  {
    title: 'Cook with confidence',
    description: 'Step-by-step cooking mode keeps you focused and on time.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCaBXffYRpJodrH1Z5Aj8pIQIjwwx_30w-SeMyWMmbOJXon97eU8Z9XHl-exP2NBibx6KfcWQs56ZTCfjWmbMgtyj_s4p0Fv2Z5OkUGyQMgKshyu35eBWiUPJPvctVKiMMfh0u1ewIW6dgj1GYaQuYYKArWMf5mCeh8RekZQUV6QmXf7saB9RpzPaScwBMpYQpAGrmP6PR5QwtCfKbCT4FLshiqXpHJ7lGZpZPCYE8G0PDvqg09pcEmDLE19CwhLQui9OweGLTBy_o',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  const canNext = index < SLIDES.length - 1;
  const buttonText = canNext ? 'Next' : 'Get Started';

  const onNext = () => {
    if (canNext) {
      setIndex((prev) => prev + 1);
    } else {
      router.replace('/auth?mode=signup');
    }
  };

  const dots = useMemo(
    () =>
      SLIDES.map((_, dotIndex) => (
        <View
          key={`dot-${dotIndex}`}
          style={[styles.dot, dotIndex === index ? styles.dotActive : styles.dotInactive]}
        />
      )),
    [index]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/auth')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.imageShell}>
        <ImageBackground source={{ uri: slide.image }} style={styles.image} imageStyle={styles.imageRadius}>
          <View style={styles.imageOverlay} />
        </ImageBackground>
      </View>

      <View style={styles.panel}>
        <View style={styles.dots}>{dots}</View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.description}</Text>

        <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.9}>
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  skip: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
  skipText: {
    color: '#F2330D',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 14,
  },
  imageShell: {
    width: '100%',
    alignItems: 'center',
  },
  image: {
    width: width - 48,
    height: (width - 48) * 1.2,
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderRadius: 28,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  panel: {
    paddingBottom: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    height: 8,
    borderRadius: 10,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#F2330D',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#E8D3CE',
  },
  title: {
    fontSize: 26,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#9C5749',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
    marginBottom: 24,
  },
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F2330D',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
