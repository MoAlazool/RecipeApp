import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Michelin-star Design Tokens
const C = {
  ivory: '#FFFEFB',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  backgroundLight: '#FAFAF8',
  backgroundDark: '#1A1510',
  cardLight: '#FFFFFF',
  cardDark: '#2A2520',
};

interface RecipeLoadingAnimationProps {
  ingredientCount: number;
  ingredientEmojis?: string[];
}

export function RecipeLoadingAnimation({
  ingredientCount,
  ingredientEmojis = ['🍅', '🥬', '🥚', '🧄'],
}: RecipeLoadingAnimationProps) {
  // Animation values
  const orbitRotation = useSharedValue(0);
  const pulse1Scale = useSharedValue(1);
  const pulse1Opacity = useSharedValue(0.08);
  const pulse2Scale = useSharedValue(1);
  const pulse2Opacity = useSharedValue(0.04);
  const aiIconScale = useSharedValue(1);
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);
  const progressX = useSharedValue(-1);
  const fadeIn = useSharedValue(0);
  const slideUp = useSharedValue(20);

  useEffect(() => {
    // Orbit rotation - slower, more elegant 16 seconds
    orbitRotation.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );

    // Pulse animation 1 - more subtle
    pulse1Scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    pulse1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.04, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(0.08, { duration: 2000, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );

    // Pulse animation 2 (delayed)
    pulse2Scale.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 2000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );
    pulse2Opacity.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(0.02, { duration: 2000, easing: Easing.out(Easing.ease) }),
          withTiming(0.04, { duration: 2000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );

    // AI Icon pulse - very subtle
    aiIconScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Bouncing dots with stagger
    const dotAnimation = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-3, { duration: 400, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        )
      );

    dot1Y.value = dotAnimation(0);
    dot2Y.value = dotAnimation(120);
    dot3Y.value = dotAnimation(240);

    // Progress bar animation - smoother
    progressX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Fade in and slide up
    fadeIn.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    slideUp.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) });
  }, []);

  // Animated styles
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotation.value}deg` }],
  }));

  const counterRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-orbitRotation.value}deg` }],
  }));

  const pulse1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1Scale.value }],
    opacity: pulse1Opacity.value,
  }));

  const pulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2Scale.value }],
    opacity: pulse2Opacity.value,
  }));

  const aiIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: aiIconScale.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progressX.value, [-1, 0, 1], [-160, 0, 160]) }],
  }));

  const textContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: slideUp.value }],
  }));

  // Get up to 4 emojis to display
  const displayEmojis = ingredientEmojis.slice(0, 4);
  while (displayEmojis.length < 4) {
    displayEmojis.push(['🍳', '🥗', '🍲', '🥘'][displayEmojis.length]);
  }

  return (
    <View style={[styles.container, { backgroundColor: C.backgroundLight }]}>
      {/* Orbit Container */}
      <View style={styles.orbitContainer}>
        {/* Pulsing Background Circles */}
        <Animated.View
          style={[
            styles.pulseCircle,
            styles.pulseCircle1,
            { backgroundColor: C.gold },
            pulse1Style,
          ]}
        />
        <Animated.View
          style={[
            styles.pulseCircle,
            styles.pulseCircle2,
            { backgroundColor: C.terracotta },
            pulse2Style,
          ]}
        />

        {/* Rotating Dashed Circle with Emoji Bubbles */}
        <Animated.View style={[styles.orbitRing, orbitStyle]}>
          {/* Dashed Border */}
          <View
            style={[
              styles.dashedBorder,
              { borderColor: 'rgba(212, 175, 55, 0.25)' },
            ]}
          />

          {/* Top Emoji */}
          <View style={[styles.emojiBubble, styles.emojiBubbleTop]}>
            <View
              style={[
                styles.emojiBubbleInner,
                {
                  backgroundColor: C.cardLight,
                  borderColor: 'rgba(26, 21, 16, 0.06)',
                },
              ]}
            >
              <Animated.Text style={[styles.emojiText, counterRotateStyle]}>
                {displayEmojis[0]}
              </Animated.Text>
            </View>
          </View>

          {/* Right Emoji */}
          <View style={[styles.emojiBubble, styles.emojiBubbleRight]}>
            <View
              style={[
                styles.emojiBubbleInner,
                {
                  backgroundColor: C.cardLight,
                  borderColor: 'rgba(26, 21, 16, 0.06)',
                },
              ]}
            >
              <Animated.Text style={[styles.emojiText, counterRotateStyle]}>
                {displayEmojis[1]}
              </Animated.Text>
            </View>
          </View>

          {/* Bottom Emoji */}
          <View style={[styles.emojiBubble, styles.emojiBubbleBottom]}>
            <View
              style={[
                styles.emojiBubbleInner,
                {
                  backgroundColor: C.cardLight,
                  borderColor: 'rgba(26, 21, 16, 0.06)',
                },
              ]}
            >
              <Animated.Text style={[styles.emojiText, counterRotateStyle]}>
                {displayEmojis[2]}
              </Animated.Text>
            </View>
          </View>

          {/* Left Emoji */}
          <View style={[styles.emojiBubble, styles.emojiBubbleLeft]}>
            <View
              style={[
                styles.emojiBubbleInner,
                {
                  backgroundColor: C.cardLight,
                  borderColor: 'rgba(26, 21, 16, 0.06)',
                },
              ]}
            >
              <Animated.Text style={[styles.emojiText, counterRotateStyle]}>
                {displayEmojis[3]}
              </Animated.Text>
            </View>
          </View>
        </Animated.View>

        {/* Center Circle with AI Icon */}
        <View
          style={[
            styles.centerCircle,
            {
              backgroundColor: C.cardLight,
              shadowColor: C.gold,
              borderColor: C.cardLight,
            },
          ]}
        >
          <View style={[styles.centerGradient, { backgroundColor: 'rgba(212, 175, 55, 0.04)' }]} />
          <Animated.View style={[styles.aiIconContainer, aiIconStyle]}>
            <Ionicons name="sparkles" size={44} color={C.gold} />
          </Animated.View>
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { backgroundColor: C.terracotta }, dot1Style]} />
            <Animated.View style={[styles.dot, { backgroundColor: C.gold }, dot2Style]} />
            <Animated.View style={[styles.dot, { backgroundColor: C.terracotta }, dot3Style]} />
          </View>
        </View>
      </View>

      {/* Text Content */}
      <Animated.View style={[styles.textContainer, textContainerStyle]}>
        <Text
          style={[
            styles.title,
            { color: C.charcoal },
          ]}
        >
          Chef AI is curating{'\n'}your menu
        </Text>
        <Text style={[styles.subtitle, { color: C.muted }]}>
          Matching{' '}
          <Text
            style={[
              styles.ingredientCount,
              {
                color: C.terracotta,
              },
            ]}
          >
            {ingredientCount} ingredients
          </Text>{' '}
          with recipes
        </Text>
      </Animated.View>

      {/* Progress Bar */}
      <Animated.View style={[styles.progressContainer, textContainerStyle]}>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: 'rgba(26, 21, 16, 0.06)' },
          ]}
        >
          <Animated.View style={[styles.progressBar, { backgroundColor: C.gold }, progressStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

const ORBIT_SIZE = 260;
const CENTER_SIZE = 110;
const EMOJI_BUBBLE_SIZE = 52;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  orbitContainer: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  pulseCircle: {
    position: 'absolute',
    borderRadius: ORBIT_SIZE / 2,
  },
  pulseCircle1: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
  },
  pulseCircle2: {
    width: ORBIT_SIZE - 80,
    height: ORBIT_SIZE - 80,
  },
  orbitRing: {
    position: 'absolute',
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashedBorder: {
    position: 'absolute',
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    borderRadius: ORBIT_SIZE / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emojiBubble: {
    position: 'absolute',
    width: EMOJI_BUBBLE_SIZE,
    height: EMOJI_BUBBLE_SIZE,
  },
  emojiBubbleInner: {
    width: EMOJI_BUBBLE_SIZE,
    height: EMOJI_BUBBLE_SIZE,
    borderRadius: EMOJI_BUBBLE_SIZE / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
  },
  emojiBubbleTop: {
    top: -EMOJI_BUBBLE_SIZE / 2,
    left: (ORBIT_SIZE - EMOJI_BUBBLE_SIZE) / 2,
  },
  emojiBubbleRight: {
    top: (ORBIT_SIZE - EMOJI_BUBBLE_SIZE) / 2,
    right: -EMOJI_BUBBLE_SIZE / 2,
  },
  emojiBubbleBottom: {
    bottom: -EMOJI_BUBBLE_SIZE / 2,
    left: (ORBIT_SIZE - EMOJI_BUBBLE_SIZE) / 2,
  },
  emojiBubbleLeft: {
    top: (ORBIT_SIZE - EMOJI_BUBBLE_SIZE) / 2,
    left: -EMOJI_BUBBLE_SIZE / 2,
  },
  emojiText: {
    fontSize: 22,
  },
  centerCircle: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 16,
    overflow: 'hidden',
  },
  centerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  aiIconContainer: {
    marginBottom: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  ingredientCount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  progressContainer: {
    marginTop: 40,
    width: 160,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
});
