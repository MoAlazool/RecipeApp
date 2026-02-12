import { type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<SlideConfig>);

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassStrong: 'rgba(255, 255, 255, 0.94)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

const GROCERY_ITEMS = [
  { name: 'Eggs', amount: '6 pcs', image: require('@/assets/images/ingredients/proteins/raw-egg.png'), checked: true },
  { name: 'Tomato', amount: '3 pcs', image: require('@/assets/images/ingredients/vegetables/tomato.png'), checked: true },
  { name: 'Olive Oil', amount: '1 bottle', image: require('@/assets/images/ingredients/oils/olive-oil-in-a-small-glass-bowl.png'), checked: true },
  { name: 'Chicken', amount: '500g', image: require('@/assets/images/ingredients/proteins/raw-chicken-breast.png'), checked: false },
  { name: 'Garlic', amount: '1 head', image: require('@/assets/images/ingredients/vegetables/garlic.png'), checked: false },
];
const ONBOARDING_BG = require('../assets/welcome-bg.png');
const GARLIC_PASTA_IMG = require('../assets/garlicpasta.jpg');
const FRIDGE_BG_IMG = require('../assets/fridge-bg.png');
const COOK_TIMER_VALUES = ['08:00', '07:59', '07:58', '07:57', '07:56', '07:55'];
const COOK_STEP_INGREDIENTS = [
  { name: 'Onion', image: require('@/assets/images/ingredients/vegetables/onion.png'), amount: '1 medium' },
  { name: 'Garlic', image: require('@/assets/images/ingredients/vegetables/garlic.png'), amount: '3 cloves' },
  { name: 'Olive Oil', image: require('@/assets/images/ingredients/oils/olive-oil-in-a-small-glass-bowl.png'), amount: '2 tbsp' },
];
const COOK_STEPS = [
  { number: '01', badge: 'STEP 1 OF 6', instruction: 'Add diced onions and sauté until golden.', tip: 'Stir occasionally for even browning.', hasTimer: false },
  { number: '02', badge: 'STEP 2 OF 6', instruction: 'Toast garlic and cumin for 60 seconds.', tip: 'Keep medium heat for a clean flavor.', hasTimer: true },
];
const GROCERY_FLOW_MS = 11000;
const CHAT_FLOW_MS = 12000;
const CARD_LIFT_Y = 100;

type SceneProps = {
  scrollX: SharedValue<number>;
  slideIndex: number;
  pageWidth: number;
  isActive: boolean;
};

type SlideConfig = {
  id: string;
  title: string;
  description: string;
  Scene: ComponentType<SceneProps>;
};

function useSceneFocusStyle(scrollX: SharedValue<number>, slideIndex: number, pageWidth: number) {
  const input = [(slideIndex - 1) * pageWidth, slideIndex * pageWidth, (slideIndex + 1) * pageWidth];

  return useAnimatedStyle(() => {
    const visible = interpolate(scrollX.value, input, [0.78, 1, 0.78], Extrapolation.CLAMP);

    return {
      opacity: visible,
      transform: [
        { scale: visible },
        { translateY: interpolate(scrollX.value, input, [10, 0, 10], Extrapolation.CLAMP) },
      ],
    };
  });
}

function PhoneSceneShell({
  frameStyle,
  children,
}: {
  frameStyle: any;
  children: ReactNode;
}) {
  return (
    <Animated.View style={[styles.sceneRoot, frameStyle]}>
      <View style={styles.boardFrameOuter}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.66)', 'rgba(255, 255, 255, 0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.boardFrameGlow}
        />
        <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.mockScreenFrame}>{children}</View>
      </View>
    </Animated.View>
  );
}

function CookStepScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const handPress = useSharedValue(0);
  const cardSwap = useSharedValue(0);
  const [timerIndex, setTimerIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const timerRunning = timerIndex > 0;
  const step = COOK_STEPS[currentStep];
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      cancelledRef.current = true;
      cancelAnimation(handPress);
      cancelAnimation(cardSwap);
      handPress.value = 0;
      cardSwap.value = 0;
      setTimerIndex(0);
      setCurrentStep(0);
      return;
    }

    cancelledRef.current = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelledRef.current) fn(); }, ms);
      timeouts.push(id);
      return id;
    };

    const runCycle = (startStep: number) => {
      if (cancelledRef.current) return;
      setCurrentStep(startStep);
      setTimerIndex(0);
      cardSwap.value = 3; // ensure visible

      if (startStep === 0) {
        // Step 0: show ingredients for 3s, then swap to step 1
        later(() => {
          cardSwap.value = 3;
          cardSwap.value = withSequence(
            withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }),
            withTiming(2, { duration: 0 }),
            withTiming(3, { duration: 380, easing: Easing.out(Easing.quad) })
          );
          later(() => {
            setCurrentStep(1);
            setTimerIndex(0);
            // After swap completes, run step 1 logic
            later(() => runStep1(), 420);
          }, 340);
        }, 3000);
      } else {
        runStep1();
      }
    };

    const runStep1 = () => {
      if (cancelledRef.current) return;
      // Hand press animation
      handPress.value = 0;
      handPress.value = withSequence(
        withTiming(0, { duration: 520 }),
        withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 460 })
      );

      // Start timer after hand press
      later(() => {
        if (cancelledRef.current) return;
        setTimerIndex(1);
        let tick = 1;
        const intervalId = setInterval(() => {
          if (cancelledRef.current) { clearInterval(intervalId); return; }
          tick++;
          if (tick < COOK_TIMER_VALUES.length) {
            setTimerIndex(tick);
          } else {
            clearInterval(intervalId);
            // Timer done → swap back to step 0
            later(() => {
              cardSwap.value = 3;
              cardSwap.value = withSequence(
                withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(2, { duration: 0 }),
                withTiming(3, { duration: 380, easing: Easing.out(Easing.quad) })
              );
              later(() => runCycle(0), 340);
            }, 600);
          }
        }, 1000);
        intervals.push(intervalId);
      }, 920);
    };

    runCycle(0);

    return () => {
      cancelledRef.current = true;
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [isActive, handPress, cardSwap]);

  const timerCardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(handPress.value, [0, 1], ['rgba(212, 175, 55, 0.2)', 'rgba(198, 110, 78, 0.52)']),
  }));

  const startButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(handPress.value, [0, 1], [1, 0.93], Extrapolation.CLAMP) }],
    backgroundColor: interpolateColor(handPress.value, [0, 1], [C.terracotta, '#A4583D']),
  }));

  const pressRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(handPress.value, [0, 0.2, 1], [0, 0.36, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(handPress.value, [0, 1], [0.78, 1.26], Extrapolation.CLAMP) }],
  }));

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(handPress.value, [0, 0.1, 1], [0, 0.7, 0.7], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(handPress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  // cardSwap: 0=idle, 1=exit done, 2=content swapped, 3=enter done
  const cardSwapStyle = useAnimatedStyle(() => {
    const phase = cardSwap.value;
    // 0→1: slide up + fade out | 2→3: slide up from below + fade in
    const translateY = phase <= 1
      ? interpolate(phase, [0, 1], [0, -28], Extrapolation.CLAMP)
      : interpolate(phase, [2, 3], [28, 0], Extrapolation.CLAMP);
    const opacity = phase <= 1
      ? interpolate(phase, [0, 1], [1, 0], Extrapolation.CLAMP)
      : interpolate(phase, [2, 3], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity };
  });

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.mockHeaderRow}>
        <View style={styles.mockHeaderButton} />
        <Text style={styles.mockRecipeName}>COOK MODE</Text>
        <View style={styles.mockHeaderButton} />
      </View>

      <Animated.View style={[styles.mockStepCard, cardSwapStyle]}>
        <Text style={styles.mockStepWatermark}>{step.number}</Text>

        <View style={styles.mockStepBadge}>
          <Text style={styles.mockStepBadgeText}>{step.badge}</Text>
        </View>

        <Text style={styles.mockStepInstruction}>{step.instruction}</Text>

        <View style={styles.mockTipContainer}>
          <View style={styles.mockTipBar} />
          <Text style={styles.mockTipText}>{step.tip}</Text>
        </View>

        {step.hasTimer ? (
          <>
            <View style={styles.mockStepMetaRow}>
              <Text style={styles.mockTimerState}>{timerRunning ? 'Timer is active' : 'Ready to start'}</Text>
            </View>

            <Animated.View style={[styles.mockTimerCard, timerCardStyle]}>
              <View style={styles.mockTimerLeft}>
                <View style={styles.mockTimerIcon}>
                  <Ionicons name="timer-outline" size={16} color={C.gold} />
                </View>
                <View>
                  <Text style={styles.mockTimerLabel}>{timerRunning ? 'TIME LEFT' : 'TIMER'}</Text>
                  <Text style={styles.mockTimerValue}>{COOK_TIMER_VALUES[timerIndex]}</Text>
                </View>
              </View>

              <View style={styles.mockStartButtonWrap}>
                <Animated.View style={[styles.mockStartRing, pressRingStyle]} />
                <Animated.View style={[styles.mockStartButton, startButtonStyle]}>
                  <Text style={styles.mockStartButtonText}>{timerRunning ? 'STOP' : 'START'}</Text>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.mockTapCircle, handStyle]} />
          </>
        ) : (
          <>
            <View style={styles.mockIngredientsDivider} />
            <Text style={styles.mockIngredientsLabel}>INGREDIENTS</Text>
            <View style={styles.mockIngredientsRow}>
              {COOK_STEP_INGREDIENTS.map((ing, i) => (
                <View key={i} style={styles.mockIngredientItem}>
                  <View style={styles.mockIngredientImageWrap}>
                    <ExpoImage source={ing.image} style={styles.mockIngredientImage} contentFit="cover" />
                  </View>
                  <Text style={styles.mockIngredientName} numberOfLines={1}>{ing.name}</Text>
                  <Text style={styles.mockIngredientAmount} numberOfLines={1}>{ing.amount}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </PhoneSceneShell>
  );
}

const GROCERY_ROW_H = 57; // 38 thumb + 9*2 padding + 1 divider

function AnimatedGroceryRow({ flow, index, item }: {
  flow: SharedValue<number>;
  index: number;
  item: typeof GROCERY_ITEMS[number];
}) {
  // Each item enters staggered (5 items)
  const enterStart = 0.40 + index * 0.025;
  const enterEnd = enterStart + 0.04;
  // First 3 items get checked then slide down
  const CHECK_TIMES = [0.56, 0.64, 0.72];
  const checkStart = item.checked ? CHECK_TIMES[index] ?? -1 : -1;
  const checkMark = checkStart > 0 ? checkStart + 0.03 : -1;
  const collapseStart = checkStart > 0 ? checkStart + 0.06 : -1;
  const collapseEnd = checkStart > 0 ? collapseStart + 0.03 : -1;

  // Wrapper collapses height so items below fill the gap
  const wrapStyle = useAnimatedStyle(() => {
    if (collapseStart < 0) return {};
    return {
      height: interpolate(flow.value, [collapseStart, collapseEnd], [GROCERY_ROW_H, 0], Extrapolation.CLAMP),
      overflow: 'hidden' as const,
    };
  });

  const rowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(flow.value,
      collapseStart > 0
        ? [enterStart, enterEnd, collapseStart, collapseEnd]
        : [enterStart, enterEnd],
      collapseStart > 0
        ? [0, 1, 1, 0]
        : [0, 1],
      Extrapolation.CLAMP);
    const translateY = interpolate(flow.value,
      collapseStart > 0
        ? [enterStart, enterEnd, collapseStart, collapseEnd]
        : [enterStart, enterEnd],
      collapseStart > 0
        ? [14, 0, 0, 20]
        : [14, 0],
      Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const nameStyle = useAnimatedStyle(() => ({
    textDecorationLine: (checkMark > 0 && flow.value > checkMark) ? 'line-through' as const : 'none' as const,
    color: (checkMark > 0 && flow.value > checkMark) ? C.muted : C.charcoal,
  }));

  const checkStyle = useAnimatedStyle(() => {
    if (checkStart < 0) return {};
    return {
      borderColor: interpolateColor(flow.value, [checkStart, checkMark], ['rgba(26, 21, 16, 0.15)', C.gold]),
      backgroundColor: interpolateColor(flow.value, [checkStart, checkMark], [C.ivory, C.gold]),
      transform: [{ scale: interpolate(flow.value, [checkStart, checkStart + 0.015, checkMark], [1, 1.2, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View style={wrapStyle}>
      {index > 0 && <View style={styles.groceryItemDivider} />}
      <Animated.View style={[styles.groceryItemRow, rowStyle]}>
        <View style={styles.groceryItemThumb}>
          <ExpoImage source={item.image} style={styles.groceryItemThumbImage} contentFit="cover" />
        </View>
        <View style={styles.groceryItemText}>
          <Animated.Text style={[styles.groceryItemName, nameStyle]}>{item.name}</Animated.Text>
          <Text style={styles.groceryItemAmount}>{item.amount}</Text>
        </View>
        <Animated.View style={[styles.groceryCheckbox, checkStyle]}>
          {item.checked && <Text style={styles.groceryCheckboxMark}>✓</Text>}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function GroceryListScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const flow = useSharedValue(0);
  const voicePulse = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(flow);
      cancelAnimation(voicePulse);
      flow.value = 0;
      voicePulse.value = 0;
      return;
    }

    flow.value = withRepeat(withTiming(1, { duration: GROCERY_FLOW_MS, easing: Easing.linear }), -1, false);
    voicePulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }), withTiming(0.18, { duration: 420 })),
      -1,
      false
    );
  }, [flow, voicePulse, isActive]);

  // Timeline:
  // 0.00–0.04: quick add bar visible with mic icon, idle
  // 0.04–0.08: tap circle on mic, mic press
  // 0.07–0.11: quick add bar fades out
  // 0.09–0.13: voice container fades in (wave bars + "Listening...")
  // 0.14–0.25: transcript words typed one by one
  // 0.25–0.34: *** PAUSE — transcript fully visible ***
  // 0.34–0.40: voice container collapses
  // 0.38–0.44: section card appears
  // 0.40–0.50: items slide in (5 items)
  // 0.56–0.65: check eggs → collapse
  // 0.64–0.73: check tomato → collapse
  // 0.72–0.81: check olive oil → collapse
  // 0.65+: done section with checked items
  // 0.85–1.00: pause, loop

  // Tap circle on mic button
  const micTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.03, 0.05, 0.09, 0.12], [0, 0.7, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.03, 0.07], [0.5, 1.1], Extrapolation.CLAMP) }],
  }));

  // Mic button press scale
  const micBtnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flow.value, [0.04, 0.07, 0.11], [1, 0.85, 1], Extrapolation.CLAMP) }],
  }));

  // Progress bar — synced with checks: 0→20→40→60%
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(flow.value,
      [0, 0.56, 0.60, 0.64, 0.68, 0.72, 0.76],
      [0, 0, 20, 20, 40, 40, 60],
      Extrapolation.CLAMP)}%`,
  }));

  // Quick add bar: visible at start, fades out when mic tapped
  const quickAddStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.07, 0.11], [1, 0], Extrapolation.CLAMP),
    height: interpolate(flow.value, [0.07, 0.12], [46, 0], Extrapolation.CLAMP),
    marginBottom: interpolate(flow.value, [0.07, 0.12], [0, -10], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));

  // Voice listening container: appears after mic tap, stays visible, then collapses
  const voiceContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.09, 0.13, 0.34, 0.40], [0, 1, 1, 0], Extrapolation.CLAMP),
    height: interpolate(flow.value,
      [0.09, 0.13, 0.34, 0.40],
      [0, 70, 70, 0],
      Extrapolation.CLAMP),
    marginBottom: interpolate(flow.value, [0.36, 0.42], [0, -10], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));

  // Transcript words typed one by one
  const word1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.14, 0.16], [0, 1], Extrapolation.CLAMP),
  }));
  const word2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.17, 0.19], [0, 1], Extrapolation.CLAMP),
  }));
  const word3Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.20, 0.22], [0, 1], Extrapolation.CLAMP),
  }));
  const word4Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.23, 0.25], [0, 1], Extrapolation.CLAMP),
  }));

  // Done badge appears after first check completes
  const doneBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.62, 0.65], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.62, 0.65], [0.6, 1], Extrapolation.CLAMP) }],
  }));

  // Section card appears after voice container collapses
  const sectionCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.36, 0.42], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.36, 0.44], [16, 0], Extrapolation.CLAMP) }],
  }));

  // Checked/done section appears after first item slides down
  const checkedSectionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.65, 0.68], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.65, 0.70], [12, 0], Extrapolation.CLAMP) }],
  }));
  // Second checked item (Tomato) appears later in done section
  const checkedItem2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.73, 0.76], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.73, 0.76], [8, 0], Extrapolation.CLAMP) }],
  }));
  // Third checked item (Olive Oil) appears last in done section
  const checkedItem3Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.81, 0.84], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.81, 0.84], [8, 0], Extrapolation.CLAMP) }],
  }));

  const waveAStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(voicePulse.value, [0, 1], [0.55, 1.08], Extrapolation.CLAMP) }],
  }));
  const waveBStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(voicePulse.value, [0, 1], [0.75, 1.28], Extrapolation.CLAMP) }],
  }));
  const waveCStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(voicePulse.value, [0, 1], [0.48, 1.16], Extrapolation.CLAMP) }],
  }));
  const waveDStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(voicePulse.value, [0, 1], [0.8, 1.3], Extrapolation.CLAMP) }],
  }));

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.grocerySceneCard}>
        <Text style={styles.groceryHeader}>Grocery List</Text>

        <View style={styles.groceryProgressWrap}>
          <View style={styles.groceryProgressInfo}>
            <Text style={styles.groceryProgressText}>5 items</Text>
            <Animated.View style={doneBadgeStyle}>
              <View style={styles.groceryDoneBadge}>
                <Ionicons name="checkmark" size={8} color="#FFF" />
                <Text style={styles.groceryDoneBadgeText}>Done</Text>
              </View>
            </Animated.View>
          </View>
          <View style={styles.groceryProgressTrack}>
            <Animated.View style={[styles.groceryProgressBar, progressBarStyle]} />
          </View>
        </View>

        {/* Quick add bar — visible at start, fades out when mic tapped */}
        <Animated.View style={[styles.groceryQuickAdd, quickAddStyle]}>
          <Text style={styles.groceryQuickAddText}>Add item...</Text>
          <View style={styles.groceryQuickActions}>
            <View style={styles.groceryMicBtnWrap}>
              <Animated.View style={[styles.groceryMicBtn, micBtnPressStyle]}>
                <Ionicons name="mic" size={16} color={C.terracotta} />
              </Animated.View>
              <Animated.View style={[styles.groceryMicTap, micTapStyle]} />
            </View>
            <View style={styles.groceryAddBtn}>
              <Text style={styles.groceryAddBtnText}>+</Text>
            </View>
          </View>
        </Animated.View>

        {/* Voice listening container — replaces quick add bar */}
        <Animated.View style={[styles.groceryVoiceContainer, voiceContainerStyle]}>
          <View style={styles.groceryVoiceHeader}>
            <View style={styles.groceryWaveRow}>
              <Animated.View style={[styles.groceryWaveBar, styles.groceryWaveBarSmall, waveAStyle]} />
              <Animated.View style={[styles.groceryWaveBar, styles.groceryWaveBarTall, waveBStyle]} />
              <Animated.View style={[styles.groceryWaveBar, styles.groceryWaveBarMedium, waveCStyle]} />
              <Animated.View style={[styles.groceryWaveBar, styles.groceryWaveBarTall, waveDStyle]} />
            </View>
            <Text style={styles.groceryVoiceLabel}>Listening...</Text>
            <View style={styles.groceryVoiceClose}>
              <Ionicons name="close" size={12} color={C.muted} />
            </View>
          </View>
          <View style={styles.groceryVoiceTranscriptRow}>
            <Text style={styles.groceryVoiceTranscript}>&quot;</Text>
            <Animated.Text style={[styles.groceryVoiceTranscript, word1Style]}>eggs, </Animated.Text>
            <Animated.Text style={[styles.groceryVoiceTranscript, word2Style]}>tomato, </Animated.Text>
            <Animated.Text style={[styles.groceryVoiceTranscript, word3Style]}>olive oil, </Animated.Text>
            <Animated.Text style={[styles.groceryVoiceTranscript, word4Style]}>chicken, garlic&quot;</Animated.Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.grocerySectionCard, sectionCardStyle]}>
          {GROCERY_ITEMS.map((item, i) => (
            <AnimatedGroceryRow key={item.name} flow={flow} index={i} item={item} />
          ))}
        </Animated.View>

        {/* Checked / Done section */}
        <Animated.View style={checkedSectionStyle}>
          <View style={styles.groceryCheckedHeader}>
            <View style={styles.groceryCheckedBadge}>
              <Ionicons name="checkmark" size={8} color="#FFF" />
            </View>
            <Text style={styles.groceryCheckedTitle}>Done</Text>
            <Text style={styles.groceryCheckedCount}>3</Text>
          </View>
          <View style={styles.grocerySectionCard}>
            {/* First checked: Eggs */}
            <View style={styles.groceryItemRow}>
              <View style={styles.groceryItemThumb}>
                <ExpoImage source={GROCERY_ITEMS[0].image} style={[styles.groceryItemThumbImage, { opacity: 0.5 }]} contentFit="cover" />
              </View>
              <View style={styles.groceryItemText}>
                <Text style={[styles.groceryItemName, { textDecorationLine: 'line-through', color: C.muted }]}>{GROCERY_ITEMS[0].name}</Text>
                <Text style={styles.groceryItemAmount}>{GROCERY_ITEMS[0].amount}</Text>
              </View>
              <View style={[styles.groceryCheckbox, { backgroundColor: C.gold, borderColor: C.gold }]}>
                <Text style={styles.groceryCheckboxMark}>✓</Text>
              </View>
            </View>
            {/* Second checked: Tomato */}
            <Animated.View style={checkedItem2Style}>
              <View style={styles.groceryItemDivider} />
              <View style={styles.groceryItemRow}>
                <View style={styles.groceryItemThumb}>
                  <ExpoImage source={GROCERY_ITEMS[1].image} style={[styles.groceryItemThumbImage, { opacity: 0.5 }]} contentFit="cover" />
                </View>
                <View style={styles.groceryItemText}>
                  <Text style={[styles.groceryItemName, { textDecorationLine: 'line-through', color: C.muted }]}>{GROCERY_ITEMS[1].name}</Text>
                  <Text style={styles.groceryItemAmount}>{GROCERY_ITEMS[1].amount}</Text>
                </View>
                <View style={[styles.groceryCheckbox, { backgroundColor: C.gold, borderColor: C.gold }]}>
                  <Text style={styles.groceryCheckboxMark}>✓</Text>
                </View>
              </View>
            </Animated.View>
            {/* Third checked: Olive Oil */}
            <Animated.View style={checkedItem3Style}>
              <View style={styles.groceryItemDivider} />
              <View style={styles.groceryItemRow}>
                <View style={styles.groceryItemThumb}>
                  <ExpoImage source={GROCERY_ITEMS[2].image} style={[styles.groceryItemThumbImage, { opacity: 0.5 }]} contentFit="cover" />
                </View>
                <View style={styles.groceryItemText}>
                  <Text style={[styles.groceryItemName, { textDecorationLine: 'line-through', color: C.muted }]}>{GROCERY_ITEMS[2].name}</Text>
                  <Text style={styles.groceryItemAmount}>{GROCERY_ITEMS[2].amount}</Text>
                </View>
                <View style={[styles.groceryCheckbox, { backgroundColor: C.gold, borderColor: C.gold }]}>
                  <Text style={styles.groceryCheckboxMark}>✓</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </PhoneSceneShell>
  );
}

function ChatBoardScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(flow);
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(withTiming(1, { duration: CHAT_FLOW_MS, easing: Easing.linear }), -1, false);
  }, [flow, isActive]);

  /* ── Phase 1: Messages list ── */
  const msgListStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0, 0.04, 0.20, 0.28], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.20, 0.28], [0, -30], Extrapolation.CLAMP) }],
  }));

  const conv1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.04, 0.10], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.04, 0.10], [12, 0], Extrapolation.CLAMP) }],
  }));

  const conv2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.08, 0.14], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.08, 0.14], [12, 0], Extrapolation.CLAMP) }],
  }));

  const tapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.15, 0.17, 0.20, 0.22], [0, 0.3, 0.3, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.15, 0.20], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  /* ── Phase 2-3: Chat view ── */
  const chatViewAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.22, 0.30], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.22, 0.30], [30, 0], Extrapolation.CLAMP) }],
  }));

  const chatHeaderAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.28, 0.34], [0, 1], Extrapolation.CLAMP),
  }));

  const msg1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.34, 0.40], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.34, 0.40], [-12, 0], Extrapolation.CLAMP) }],
  }));

  const recipeCardAnim = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.40, 0.50], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.40, 0.50], [16, 0], Extrapolation.CLAMP) }],
  }));

  const msg2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.52, 0.58], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.52, 0.58], [-12, 0], Extrapolation.CLAMP) }],
  }));

  const mealPlanAnim = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.58, 0.68], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.58, 0.68], [16, 0], Extrapolation.CLAMP) }],
  }));

  const composerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.68, 0.74], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.chatSceneWrap}>
        {/* ── Phase 1: Messages list ── */}
        <Animated.View style={[styles.chatMsgListLayer, msgListStyle]}>
          <Text style={styles.chatMsgListTitle}>Messages</Text>

          <View style={styles.chatSearchBar}>
            <Ionicons name="search-outline" size={13} color={C.muted} />
            <Text style={styles.chatSearchText}>Search conversations...</Text>
          </View>

          {/* Conversation 1 — Eitan (unread) */}
          <Animated.View style={[styles.chatConvItem, styles.chatConvItemUnread, conv1Style]}>
            <View style={styles.chatConvAvatarWrap}>
              <View style={[styles.chatAvatar, { backgroundColor: C.terracotta }]}>
                <Text style={styles.chatAvatarText}>ET</Text>
              </View>
              <View style={styles.chatConvUnreadDot} />
            </View>
            <View style={styles.chatRowContent}>
              <View style={styles.chatRowHeader}>
                <Text style={[styles.chatRowName, styles.chatRowNameBold]}>Eitan</Text>
                <Text style={[styles.chatRowTime, styles.chatRowTimeUnread]}>now</Text>
              </View>
              <View style={styles.chatConvFooter}>
                <Text style={styles.chatRowMessage} numberOfLines={1}>Shared a recipe with you</Text>
                <View style={styles.chatUnreadBadge}>
                  <Text style={styles.chatUnreadBadgeText}>2</Text>
                </View>
              </View>
            </View>
            <Animated.View style={[styles.chatTapCircle, tapStyle]} />
          </Animated.View>

          {/* Conversation 2 — Weekend Cooks */}
          <Animated.View style={[styles.chatConvItem, conv2Style]}>
            <View style={[styles.chatAvatar, { backgroundColor: C.gold }]}>
              <Text style={styles.chatAvatarText}>WC</Text>
            </View>
            <View style={styles.chatRowContent}>
              <View style={styles.chatRowHeader}>
                <View style={styles.chatGroupNameRow}>
                  <Text style={styles.chatRowName}>Weekend Cooks</Text>
                  <View style={styles.chatGroupTag}>
                    <Text style={styles.chatGroupTagText}>Group</Text>
                  </View>
                </View>
                <Text style={styles.chatRowTime}>5m</Text>
              </View>
              <Text style={styles.chatRowMessage}>Nora: Great meal plan!</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Phase 2-3: Chat view ── */}
        <Animated.View style={[styles.chatViewLayer, chatViewAnimStyle]}>
          <Animated.View style={[styles.chatViewHeader, chatHeaderAnimStyle]}>
            <Ionicons name="chevron-back" size={18} color={C.charcoal} />
            <View style={[styles.chatViewHeaderAvatar, { backgroundColor: C.terracotta }]}>
              <Text style={styles.chatViewHeaderAvatarText}>ET</Text>
            </View>
            <View>
              <Text style={styles.chatViewHeaderName}>Eitan</Text>
              <Text style={styles.chatViewHeaderSub}>Online</Text>
            </View>
          </Animated.View>

          <View style={styles.chatViewBody}>
            {/* Text message */}
            <Animated.View style={[styles.chatBubbleLeft, msg1Style]}>
              <Text style={styles.chatBubbleText}>Hey! You have to try this 😍</Text>
            </Animated.View>

            {/* Recipe card */}
            <Animated.View style={[styles.chatRecipeCard, recipeCardAnim]}>
              <View style={styles.chatRecipeImg}>
                <ExpoImage source={GARLIC_PASTA_IMG} style={styles.chatRecipePhoto} contentFit="cover" />
                <View style={styles.chatRecipeBadge}>
                  <Ionicons name="restaurant-outline" size={8} color={C.ivory} />
                  <Text style={styles.chatRecipeBadgeText}>Recipe</Text>
                </View>
                <View style={styles.chatRecipeTimeBadge}>
                  <Ionicons name="time-outline" size={8} color={C.ivory} />
                  <Text style={styles.chatRecipeTimeText}>25 min</Text>
                </View>
              </View>
              <View style={styles.chatRecipeContent}>
                <Text style={styles.chatRecipeTitle}>Creamy Garlic Pasta</Text>
                <View style={styles.chatRecipeDifficulty}>
                  <View style={[styles.chatRecipeDiffDot, { backgroundColor: '#6B8E23' }]} />
                  <Text style={styles.chatRecipeDiffText}>Easy</Text>
                </View>
                <View style={styles.chatRecipeAction}>
                  <Text style={styles.chatRecipeActionText}>Tap to view recipe</Text>
                  <Ionicons name="chevron-forward" size={10} color={C.terracotta} />
                </View>
              </View>
            </Animated.View>

            {/* Text message */}
            <Animated.View style={[styles.chatBubbleLeft, msg2Style]}>
              <Text style={styles.chatBubbleText}>Also planned our meals 📋</Text>
            </Animated.View>

            {/* Meal plan card */}
            <Animated.View style={[styles.chatMealPlanCard, mealPlanAnim]}>
              <LinearGradient
                colors={['rgba(245, 243, 238, 0.95)', 'rgba(237, 233, 224, 0.85)']}
                style={styles.chatMpHeader}
              >
                <View style={styles.chatMpBadge}>
                  <Ionicons name="calendar-outline" size={9} color={C.gold} />
                  <Text style={styles.chatMpBadgeText}>Meal Plan</Text>
                </View>
                <Text style={styles.chatMpTitle}>Monday</Text>
                <Text style={styles.chatMpSubtitle}>3 meals planned</Text>
              </LinearGradient>
              <View style={styles.chatMpBody}>
                <View style={styles.chatMpMealRow}>
                  <View style={[styles.chatMpAccent, { backgroundColor: '#FB923C' }]} />
                  <Text style={styles.chatMpMealLabel}>Breakfast</Text>
                  <Text style={styles.chatMpMealName}>Avocado Toast</Text>
                </View>
                <View style={styles.chatMpMealRow}>
                  <View style={[styles.chatMpAccent, { backgroundColor: '#4ADE80' }]} />
                  <Text style={styles.chatMpMealLabel}>Lunch</Text>
                  <Text style={styles.chatMpMealName}>Grilled Chicken</Text>
                </View>
                <View style={styles.chatMpMealRow}>
                  <View style={[styles.chatMpAccent, { backgroundColor: '#60A5FA' }]} />
                  <Text style={styles.chatMpMealLabel}>Dinner</Text>
                  <Text style={styles.chatMpMealName}>Garlic Pasta</Text>
                </View>
              </View>
              <View style={styles.chatMpActions}>
                <View style={styles.chatMpViewBtn}>
                  <Text style={styles.chatMpViewText}>View</Text>
                </View>
                <View style={styles.chatMpSaveBtn}>
                  <Ionicons name="bookmark-outline" size={10} color={C.gold} />
                  <Text style={styles.chatMpSaveText}>Save</Text>
                </View>
              </View>
            </Animated.View>
          </View>

        </Animated.View>
      </View>
    </PhoneSceneShell>
  );
}

const AI_CHEF_FLOW_MS = 12000;

function AIChefScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(flow);
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(withTiming(1, { duration: AI_CHEF_FLOW_MS, easing: Easing.linear }), -1, false);
  }, [flow, isActive]);

  // ────────────────────────────────────
  // TIMELINE (12 s loop)
  // 0.00–0.00  recipe + pills visible instantly
  // 0.04–0.08  hand indicator appears near ASK pill
  // 0.08–0.10  ASK pill press ring expands
  // 0.10–0.12  ASK pill scales down (pressed)
  // 0.12–0.16  recipe dims + shifts up, hand fades
  // 0.14–0.24  AI sheet slides up
  // 0.22–0.28  sheet header appears
  // 0.26–0.32  inspiration pills slide in
  // 0.32–0.35  "Spice it up" highlights gold
  // 0.35–0.41  user message appears
  // 0.41–0.44  typing dots appear
  // 0.44–0.54  dots pulse
  // 0.54–0.62  AI response card
  // 0.62–0.68  save button
  // 0.70–1.00  hold / loop
  // ────────────────────────────────────

  /* ── Recipe peek (always visible, dims after press) ── */
  const recipeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.12, 0.20], [1, 0.3], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.12, 0.20], [0, -16], Extrapolation.CLAMP) }],
  }));

  /* ── Hand indicator (finger tap circle near ASK) ── */
  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.04, 0.06, 0.12, 0.14], [0, 0.7, 0.7, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(flow.value, [0.04, 0.08], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  /* ── ASK pill press ring (expanding glow behind pill) ── */
  const askRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.06, 0.09, 0.14], [0, 0.36, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.06, 0.14], [0.78, 1.3], Extrapolation.CLAMP) }],
  }));

  /* ── ASK pill press scale + color ── */
  const askPillPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flow.value, [0.08, 0.10, 0.13], [1, 0.90, 1], Extrapolation.CLAMP) }],
    backgroundColor: interpolateColor(
      flow.value,
      [0.08, 0.10, 0.13],
      ['rgba(255, 255, 255, 0.85)', 'rgba(212, 175, 55, 0.25)', 'rgba(255, 255, 255, 0.85)']
    ),
    borderColor: interpolateColor(
      flow.value,
      [0.08, 0.10],
      ['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.8)']
    ),
  }));

  /* ── AI Sheet ── */
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(flow.value, [0.14, 0.24], [340, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(flow.value, [0.14, 0.20], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.22, 0.28], [0, 1], Extrapolation.CLAMP),
  }));

  const inspirationStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.26, 0.32], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.26, 0.32], [20, 0], Extrapolation.CLAMP) }],
  }));

  const spicePillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flow.value,
      [0.32, 0.35],
      ['rgba(212, 175, 55, 0.08)', 'rgba(212, 175, 55, 1)']
    ),
    borderColor: interpolateColor(
      flow.value,
      [0.32, 0.35],
      ['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 1)']
    ),
  }));

  const spicePillTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flow.value, [0.32, 0.35], ['#D4AF37', '#FFFFFF']),
  }));

  const userMsgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.35, 0.41], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(flow.value, [0.35, 0.41], [12, 0], Extrapolation.CLAMP) }],
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.41, 0.44, 0.52, 0.54], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.41, 0.45, 0.49, 0.53], [0.9, 1.05, 0.9, 1], Extrapolation.CLAMP) }],
  }));

  const aiCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.54, 0.62], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.54, 0.62], [16, 0], Extrapolation.CLAMP) }],
  }));

  const saveBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.62, 0.68], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.aiSceneWrap}>
        {/* ── Recipe peek (visible from start) ── */}
        <Animated.View style={[styles.aiRecipePeek, recipeStyle]}>
          <View style={styles.aiRecipeImgPeek}>
            <ExpoImage source={GARLIC_PASTA_IMG} style={styles.aiRecipePhoto} contentFit="cover" />
          </View>
          <Text style={styles.aiRecipeTitle}>Creamy Garlic Pasta</Text>
          <Text style={styles.aiRecipeDesc}>A rich and creamy pasta with roasted garlic</Text>

          <View style={styles.aiPillsRow}>
            <View style={styles.aiActionPill}>
              <Ionicons name="paper-plane-outline" size={11} color={C.charcoal} />
              <Text style={styles.aiActionPillText}>SEND</Text>
            </View>
            <View style={styles.aiAskPillWrap}>
              <Animated.View style={[styles.aiAskPressRing, askRingStyle]} />
              <Animated.View style={[styles.aiActionPill, styles.aiActionPillAsk, askPillPressStyle]}>
                <Ionicons name="sparkles-outline" size={11} color={C.gold} />
                <Text style={[styles.aiActionPillText, { color: C.gold }]}>ASK</Text>
              </Animated.View>
              <Animated.View style={[styles.aiHandCircle, handStyle]} />
            </View>
            <View style={styles.aiActionPill}>
              <Ionicons name="bookmark-outline" size={11} color={C.charcoal} />
              <Text style={styles.aiActionPillText}>SAVE</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── AI Chef Sheet ── */}
        <Animated.View style={[styles.aiSheetLayer, sheetStyle]}>
          <View style={styles.aiSheetHandle} />

          <Animated.View style={[styles.aiSheetHeaderRow, sheetHeaderStyle]}>
            <Ionicons name="sparkles" size={14} color={C.gold} />
            <Text style={styles.aiSheetTitle}>AI Chef</Text>
          </Animated.View>

          {/* Inspiration pills */}
          <Animated.View style={[styles.aiInspirationRow, inspirationStyle]}>
            <Animated.View style={[styles.aiInspPill, spicePillStyle]}>
              <Animated.Text style={[styles.aiInspPillText, spicePillTextStyle]}>🌶 Spice it up</Animated.Text>
            </Animated.View>
            <View style={styles.aiInspPill}>
              <Text style={styles.aiInspPillText}>🥗 Lighten it</Text>
            </View>
            <View style={styles.aiInspPill}>
              <Text style={styles.aiInspPillText}>⚡ Under 15m</Text>
            </View>
          </Animated.View>

          <View style={styles.aiChatArea}>
            {/* User message */}
            <Animated.View style={[styles.aiUserBubble, userMsgStyle]}>
              <Text style={styles.aiUserBubbleText}>Make it spicier with bolder heat</Text>
            </Animated.View>

            {/* Typing dots */}
            <Animated.View style={[styles.aiTypingDots, dotsStyle]}>
              <View style={styles.aiDot} />
              <View style={styles.aiDot} />
              <View style={styles.aiDot} />
            </Animated.View>

            {/* AI Response card */}
            <Animated.View style={[styles.aiResponseCard, aiCardStyle]}>
              <View style={styles.aiResponseBadgeRow}>
                <Ionicons name="sparkles" size={9} color={C.gold} />
                <Text style={styles.aiResponseBadgeText}>New Recipe</Text>
              </View>
              <Text style={styles.aiResponseTitle}>Spicy Garlic Pasta</Text>
              <View style={styles.aiResponseMetaRow}>
                <View style={styles.aiResponseMeta}>
                  <Ionicons name="time-outline" size={9} color={C.muted} />
                  <Text style={styles.aiResponseMetaText}>20m</Text>
                </View>
                <View style={styles.aiResponseMeta}>
                  <Ionicons name="people-outline" size={9} color={C.muted} />
                  <Text style={styles.aiResponseMetaText}>4</Text>
                </View>
                <View style={styles.aiResponseMeta}>
                  <Ionicons name="flame-outline" size={9} color={C.muted} />
                  <Text style={styles.aiResponseMetaText}>450 cal</Text>
                </View>
              </View>
              <Text style={styles.aiResponseSubtext}>8 ingredients · 5 steps</Text>
              <View style={styles.aiResponseAction}>
                <Text style={styles.aiResponseActionText}>Tap to view full recipe</Text>
                <Ionicons name="chevron-forward" size={10} color={C.terracotta} />
              </View>
            </Animated.View>

            {/* Save button */}
            <Animated.View style={[styles.aiSaveRow, saveBtnStyle]}>
              <View style={styles.aiSaveBtn}>
                <Ionicons name="bookmark-outline" size={11} color={C.gold} />
                <Text style={styles.aiSaveBtnText}>Save Recipe</Text>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </PhoneSceneShell>
  );
}

const EXTRACT_FLOW_MS = 12000;

function ExtractScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(flow);
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(withTiming(1, { duration: EXTRACT_FLOW_MS, easing: Easing.linear }), -1, false);
  }, [flow, isActive]);

  /* ── Layer 1: URL Input ── */
  const inputLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0, 0.04, 0.19, 0.24], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));

  const urlTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.05, 0.10], [0, 1], Extrapolation.CLAMP),
  }));

  const detectedBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.10, 0.14], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.10, 0.14], [6, 0], Extrapolation.CLAMP) }],
  }));

  const extractTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.15, 0.17, 0.19, 0.21], [0, 0.35, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.15, 0.19], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  /* ── Layer 2: Extracting ── */
  const extractLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.22, 0.28, 0.46, 0.52], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.26, 0.32], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.26, 0.32], [0.95, 1], Extrapolation.CLAMP) }],
  }));

  const extractTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.30, 0.36], [0, 1], Extrapolation.CLAMP),
  }));

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      flow.value,
      [0.32, 0.35, 0.38, 0.41, 0.44, 0.47],
      [0, 0.6, 0.3, 0.6, 0.3, 0.6],
      Extrapolation.CLAMP
    ),
  }));

  /* ── Layer 3: Result ── */
  const resultLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.50, 0.56], [0, 1], Extrapolation.CLAMP),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.54, 0.60], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.54, 0.58], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const recipeCardAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.58, 0.66], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.58, 0.66], [16, 0], Extrapolation.CLAMP) }],
  }));

  const ingredientsAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.64, 0.70], [0, 1], Extrapolation.CLAMP),
  }));

  const saveAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.70, 0.76], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.extSceneWrap}>
        {/* ── Layer 1: URL Input ── */}
        <Animated.View style={[styles.extInputLayer, inputLayerStyle]}>
          <View style={styles.extInputHeader}>
            <Text style={styles.extInputTitle}>Add Recipe</Text>
            <Text style={styles.extInputSub}>Paste a video or website link</Text>
          </View>

          <View style={styles.extPlatformRow}>
            <View style={[styles.extPlatformIcon, { backgroundColor: 'rgba(255, 0, 0, 0.08)' }]}>
              <Ionicons name="logo-youtube" size={14} color="#FF0000" />
            </View>
            <View style={[styles.extPlatformIcon, { backgroundColor: 'rgba(0, 0, 0, 0.06)' }]}>
              <Ionicons name="logo-tiktok" size={14} color="#000000" />
            </View>
            <View style={[styles.extPlatformIcon, { backgroundColor: 'rgba(228, 64, 95, 0.08)' }]}>
              <Ionicons name="logo-instagram" size={14} color="#E4405F" />
            </View>
            <View style={[styles.extPlatformIcon, { backgroundColor: 'rgba(26, 21, 16, 0.06)' }]}>
              <Ionicons name="globe-outline" size={14} color={C.charcoal} />
            </View>
          </View>

          <View style={styles.extUrlField}>
            <Ionicons name="link" size={13} color={C.muted} />
            <Animated.Text style={[styles.extUrlText, urlTextStyle]} numberOfLines={1}>
              instagram.com/reel/@eitan/...
            </Animated.Text>
          </View>

          <Animated.View style={[styles.extDetectedBadge, detectedBadgeStyle]}>
            <Ionicons name="logo-instagram" size={11} color="#E4405F" />
            <Text style={styles.extDetectedText}>Instagram Detected</Text>
          </Animated.View>

          <View style={styles.extExtractBtn}>
            <Text style={styles.extExtractBtnText}>Extract Recipe</Text>
            <Animated.View style={[styles.extExtractTap, extractTapStyle]} />
          </View>
        </Animated.View>

        {/* ── Layer 2: Extracting ── */}
        <Animated.View style={[styles.extExtractLayer, extractLayerStyle]}>
          <Animated.View style={[styles.extThumbWrap, thumbStyle]}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.03)', 'rgba(0, 0, 0, 0.07)']}
              style={styles.extThumb}
            >
              <Ionicons name="logo-instagram" size={28} color="rgba(228, 64, 95, 0.12)" />
            </LinearGradient>
            <View style={styles.extAiBadge}>
              <Ionicons name="sparkles" size={10} color={C.gold} />
              <Text style={styles.extAiBadgeText}>AI extracting</Text>
            </View>
          </Animated.View>

          <Animated.View style={extractTextStyle}>
            <Text style={styles.extExtractTitle}>Analyzing recipe...</Text>
            <Text style={styles.extExtractSub}>
              Reading Instagram reel and identifying ingredients
            </Text>
          </Animated.View>

          <Animated.View style={[styles.extSkeletonWrap, skeletonStyle]}>
            <View style={[styles.extSkeletonLine, { width: '70%' }]} />
            <View style={[styles.extSkeletonLine, { width: '90%' }]} />
            <View style={[styles.extSkeletonLine, { width: '55%' }]} />
          </Animated.View>
        </Animated.View>

        {/* ── Layer 3: Result ── */}
        <Animated.View style={[styles.extResultLayer, resultLayerStyle]}>
          <Animated.View style={[styles.extResultHeader, checkStyle]}>
            <View style={styles.extCheckCircle}>
              <Ionicons name="checkmark" size={14} color={C.gold} />
            </View>
            <View>
              <Text style={styles.extResultTitle}>Recipe Extracted</Text>
              <Text style={styles.extResultSub}>Review before saving</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.extRecipeCard, recipeCardAnimStyle]}>
            <Text style={styles.extRecipeName}>Crispy Chicken Tacos</Text>
            <View style={styles.extRecipeMetaRow}>
              <View style={styles.extRecipeMeta}>
                <Ionicons name="time-outline" size={9} color={C.muted} />
                <Text style={styles.extRecipeMetaText}>25 min</Text>
              </View>
              <View style={styles.extRecipeMeta}>
                <Ionicons name="people-outline" size={9} color={C.muted} />
                <Text style={styles.extRecipeMetaText}>4 servings</Text>
              </View>
              <View style={styles.extRecipeMeta}>
                <Ionicons name="speedometer-outline" size={9} color={C.muted} />
                <Text style={styles.extRecipeMetaText}>Easy</Text>
              </View>
            </View>

            <View style={styles.extSourceRow}>
              <Ionicons name="logo-instagram" size={10} color="#E4405F" />
              <Text style={styles.extSourceText}>@eitan · Instagram</Text>
            </View>

            <Animated.View style={[styles.extIngredientsWrap, ingredientsAnimStyle]}>
              <Text style={styles.extIngredientsLabel}>INGREDIENTS</Text>
              <View style={styles.extIngRow}>
                <View style={[styles.extIngDot, { backgroundColor: C.terracotta }]} />
                <Text style={styles.extIngText}>4 chicken thighs, boneless</Text>
              </View>
              <View style={styles.extIngRow}>
                <View style={[styles.extIngDot, { backgroundColor: C.gold }]} />
                <Text style={styles.extIngText}>8 small corn tortillas</Text>
              </View>
              <View style={styles.extIngRow}>
                <View style={[styles.extIngDot, { backgroundColor: '#6B8E23' }]} />
                <Text style={styles.extIngText}>1 cup salsa verde</Text>
              </View>
              <Text style={styles.extIngMore}>+5 more ingredients</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.extBtnRow, saveAnimStyle]}>
            <View style={styles.extDiscardBtn}>
              <Text style={styles.extDiscardText}>Discard</Text>
            </View>
            <View style={styles.extSaveBtn}>
              <Ionicons name="checkmark" size={13} color="#FFF" />
              <Text style={styles.extSaveBtnText}>Save Recipe</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </PhoneSceneShell>
  );
}

const FRIDGE_FLOW_MS = 12000;

const FRIDGE_ITEMS = [
  { name: 'Eggs', confidence: 94, qty: '6 pcs', image: require('@/assets/images/ingredients/proteins/raw-egg.png'), bg: '#FEF3C7' },
  { name: 'Tomatoes', confidence: 91, qty: '3 pcs', image: require('@/assets/images/ingredients/vegetables/tomato.png'), bg: '#FEE2E2' },
  { name: 'Chicken', confidence: 87, qty: '500g', image: require('@/assets/images/ingredients/proteins/raw-chicken-breast.png'), bg: '#FFF7ED' },
  { name: 'Garlic', confidence: 82, qty: '1 head', image: require('@/assets/images/ingredients/vegetables/garlic.png'), bg: '#F0FDF4' },
];

const FRIDGE_MARKERS = [
  { top: '22%', left: '28%' },
  { top: '38%', left: '68%' },
  { top: '55%', left: '32%' },
  { top: '48%', left: '72%' },
];

function FridgeScene({ scrollX, slideIndex, pageWidth, isActive }: SceneProps) {
  const frameStyle = useSceneFocusStyle(scrollX, slideIndex, pageWidth);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(flow);
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(withTiming(1, { duration: FRIDGE_FLOW_MS, easing: Easing.linear }), -1, false);
  }, [flow, isActive]);

  // ────────────────────────────────────
  // TIMELINE (12 s loop)
  // 0.00–0.03  home screen fades in
  // 0.05–0.08  tap circle on "Scan Fridge" pill
  // 0.08–0.12  home fades out → camera fades in
  // 0.14–0.18  camera idle (viewfinder, shutter)
  // 0.18–0.20  tap on shutter
  // 0.20–0.22  shutter press + flash
  // 0.22–0.26  camera UI fades out
  // 0.24–0.28  scan badge appears
  // 0.26–0.32  marker 1
  // 0.30–0.36  marker 2
  // 0.34–0.40  marker 3
  // 0.38–0.44  marker 4
  // 0.46–0.54  sheet slides up
  // 0.50–0.54  detection header
  // 0.54–0.60  item 1
  // 0.58–0.64  item 2
  // 0.62–0.68  item 3
  // 0.66–0.72  item 4
  // 0.74–0.80  find button
  // 0.82–0.86  tap on find
  // 0.88–1.00  hold / loop
  // ────────────────────────────────────

  /* ═══ LAYER 1: Home screen ═══ */
  const homeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0, 0.03, 0.08, 0.12], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));

  const homePillsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.02, 0.05], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.02, 0.05], [8, 0], Extrapolation.CLAMP) }],
  }));

  const scanPillTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.05, 0.06, 0.08, 0.09], [0, 0.35, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.05, 0.08], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  const scanPillPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flow.value, [0.06, 0.08, 0.10], [1, 0.92, 1], Extrapolation.CLAMP) }],
    backgroundColor: interpolateColor(flow.value, [0.06, 0.08], ['#FFFFFF', 'rgba(212, 175, 55, 0.15)']),
  }));

  /* ═══ LAYER 2: Camera + scan ═══ */
  const camLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.08, 0.14], [0, 1], Extrapolation.CLAMP),
  }));

  const camUiStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.12, 0.16, 0.22, 0.26], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.13, 0.17], [0, 1], Extrapolation.CLAMP),
  }));

  const shutterTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.18, 0.19, 0.21, 0.22], [0, 0.4, 0.4, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.18, 0.21], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  const shutterPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flow.value, [0.19, 0.21, 0.23], [1, 0.82, 1], Extrapolation.CLAMP) }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.20, 0.215, 0.24], [0, 0.9, 0], Extrapolation.CLAMP),
  }));

  /* ── Scanning badge ── */
  const scanBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.24, 0.28, 0.44, 0.48], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.24, 0.28], [0.8, 1], Extrapolation.CLAMP) }],
  }));

  /* ── Detection markers ── */
  const marker1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.26, 0.32], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.26, 0.32], [0.5, 1], Extrapolation.CLAMP) }],
  }));
  const marker2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.30, 0.36], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.30, 0.36], [0.5, 1], Extrapolation.CLAMP) }],
  }));
  const marker3Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.34, 0.40], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.34, 0.40], [0.5, 1], Extrapolation.CLAMP) }],
  }));
  const marker4Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.38, 0.44], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.38, 0.44], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  /* ── Pulse rings ── */
  const pulse1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.28, 0.32, 0.38, 0.42], [0, 0.5, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.28, 0.42], [0.8, 2.5], Extrapolation.CLAMP) }],
  }));
  const pulse2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.32, 0.36, 0.42, 0.46], [0, 0.5, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.32, 0.46], [0.8, 2.5], Extrapolation.CLAMP) }],
  }));
  const pulse3Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.36, 0.40, 0.46, 0.50], [0, 0.5, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.36, 0.50], [0.8, 2.5], Extrapolation.CLAMP) }],
  }));
  const pulse4Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.40, 0.44, 0.50, 0.54], [0, 0.5, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.40, 0.54], [0.8, 2.5], Extrapolation.CLAMP) }],
  }));

  /* ═══ LAYER 3: Results sheet ═══ */
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(flow.value, [0.46, 0.54], [260, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(flow.value, [0.46, 0.50], [0, 1], Extrapolation.CLAMP),
  }));

  const detectionLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.50, 0.54], [0, 1], Extrapolation.CLAMP),
  }));

  const item1Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.54, 0.60], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.54, 0.60], [12, 0], Extrapolation.CLAMP) }],
  }));
  const item2Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.58, 0.64], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.58, 0.64], [12, 0], Extrapolation.CLAMP) }],
  }));
  const item3Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.62, 0.68], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.62, 0.68], [12, 0], Extrapolation.CLAMP) }],
  }));
  const item4Style = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.66, 0.72], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.66, 0.72], [12, 0], Extrapolation.CLAMP) }],
  }));

  const findBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.74, 0.80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(flow.value, [0.74, 0.80], [8, 0], Extrapolation.CLAMP) }],
  }));

  const findTapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.82, 0.84, 0.86, 0.88], [0, 0.35, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(flow.value, [0.82, 0.86], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  const markerStyles = [marker1Style, marker2Style, marker3Style, marker4Style];
  const pulseStyles = [pulse1Style, pulse2Style, pulse3Style, pulse4Style];
  const itemStyles = [item1Style, item2Style, item3Style, item4Style];

  return (
    <PhoneSceneShell frameStyle={frameStyle}>
      <View style={styles.fridgeSceneWrap}>
        {/* ═══ LAYER 1: Home screen ═══ */}
        <Animated.View style={[styles.fridgeHomeLayer, homeStyle]}>
          {/* Top bar */}
          <View style={styles.fridgeHomeTopBar}>
            <View style={styles.fridgeHomeUserRow}>
              <View style={styles.fridgeHomeAvatar}>
                <Text style={styles.fridgeHomeAvatarText}>E</Text>
              </View>
              <View>
                <Text style={styles.fridgeHomeGreeting}>WELCOME BACK</Text>
                <Text style={styles.fridgeHomeName}>Eitan</Text>
              </View>
            </View>
            <View style={styles.fridgeHomeAddBtn}>
              <Ionicons name="add" size={16} color="#FFF" />
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.fridgeHomeSearch}>
            <Ionicons name="search-outline" size={13} color={C.muted} />
            <Text style={styles.fridgeHomeSearchText}>Search your recipes...</Text>
          </View>

          {/* Action pills */}
          <Animated.View style={[styles.fridgeHomePillsRow, homePillsStyle]}>
            <View style={styles.fridgeHomePill}>
              <View style={[styles.fridgeHomePillIcon, { backgroundColor: 'rgba(198, 110, 78, 0.10)' }]}>
                <Ionicons name="link" size={14} color={C.terracotta} />
              </View>
              <Text style={styles.fridgeHomePillLabel}>Paste Link</Text>
            </View>

            <Animated.View style={[styles.fridgeHomePill, scanPillPressStyle]}>
              <View style={[styles.fridgeHomePillIcon, { backgroundColor: 'rgba(212, 175, 55, 0.10)' }]}>
                <Ionicons name="scan" size={14} color={C.gold} />
              </View>
              <Text style={styles.fridgeHomePillLabel}>Scan Fridge</Text>
              <Animated.View style={[styles.fridgeHomePillTap, scanPillTapStyle]} />
            </Animated.View>

            <View style={styles.fridgeHomePill}>
              <View style={[styles.fridgeHomePillIcon, { backgroundColor: 'rgba(26, 21, 16, 0.06)' }]}>
                <Ionicons name="book-outline" size={14} color={C.charcoal} />
              </View>
              <Text style={styles.fridgeHomePillLabel}>Scan Book</Text>
            </View>
          </Animated.View>

          {/* Recent section hint */}
          <View style={styles.fridgeHomeSectionRow}>
            <Text style={styles.fridgeHomeSectionTitle}>Recent</Text>
            <Text style={styles.fridgeHomeSectionLink}>See all</Text>
          </View>
          <View style={styles.fridgeHomeRecentPlaceholder}>
            <View style={styles.fridgeHomeRecentCard} />
            <View style={[styles.fridgeHomeRecentCard, { opacity: 0.5 }]} />
          </View>
        </Animated.View>

        {/* ═══ LAYER 2: Camera + scan ═══ */}
        <Animated.View style={[styles.fridgeBgLayer, camLayerStyle]}>
          <ExpoImage source={FRIDGE_BG_IMG} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.fridgeOverlay} />

          {/* Camera UI overlay */}
          <Animated.View style={[StyleSheet.absoluteFill, camUiStyle]} pointerEvents="none">
            <View style={styles.fridgeCamTopBar}>
              <View style={styles.fridgeCamBtn}>
                <Ionicons name="close" size={16} color="#FFF" />
              </View>
              <Text style={styles.fridgeCamTitle}>Scan Fridge</Text>
              <View style={styles.fridgeCamBtn}>
                <Ionicons name="flash-outline" size={16} color={C.gold} />
              </View>
            </View>

            <Animated.View style={[styles.fridgeViewfinder, cornerStyle]}>
              <View style={[styles.fridgeCorner, styles.fridgeCornerTL]} />
              <View style={[styles.fridgeCorner, styles.fridgeCornerTR]} />
              <View style={[styles.fridgeCorner, styles.fridgeCornerBL]} />
              <View style={[styles.fridgeCorner, styles.fridgeCornerBR]} />
            </Animated.View>

            <View style={styles.fridgeCamBottomBar}>
              <View style={styles.fridgeCamGallery}>
                <Ionicons name="images-outline" size={16} color="#FFF" />
              </View>
              <View style={styles.fridgeShutterWrap}>
                <Animated.View style={[styles.fridgeShutterOuter, shutterPressStyle]}>
                  <View style={styles.fridgeShutterInner} />
                </Animated.View>
                <Animated.View style={[styles.fridgeShutterTap, shutterTapStyle]} />
              </View>
              <View style={styles.fridgeCamFlip}>
                <Ionicons name="camera-reverse-outline" size={16} color="#FFF" />
              </View>
            </View>
          </Animated.View>

          {/* Flash */}
          <Animated.View style={[styles.fridgeFlash, flashStyle]} pointerEvents="none" />

          {/* Scanning badge */}
          <View style={styles.fridgeScanBadgeRow} pointerEvents="none">
            <Animated.View style={[styles.fridgeScanBadge, scanBadgeStyle]}>
              <Ionicons name="scan-outline" size={12} color={C.gold} />
              <Text style={styles.fridgeScanBadgeText}>AI Scanning...</Text>
            </Animated.View>
          </View>

          {/* Detection markers */}
          {FRIDGE_MARKERS.map((pos, i) => (
            <View key={i} style={[styles.fridgeMarkerPos, { top: pos.top as any, left: pos.left as any }]}>
              <Animated.View style={[styles.fridgePulseRing, pulseStyles[i]]} />
              <Animated.View
                style={[
                  styles.fridgeMarkerDot,
                  markerStyles[i],
                  i === 0 && { backgroundColor: C.terracotta, borderColor: '#FFFFFF' },
                ]}
              />
            </View>
          ))}
        </Animated.View>

        {/* ═══ LAYER 3: Results sheet ═══ */}
        <Animated.View style={[styles.fridgeSheetLayer, sheetStyle]}>
          <View style={styles.fridgeSheetHandle} />

          <Animated.View style={[styles.fridgeSheetHeader, detectionLabelStyle]}>
            <View>
              <Text style={styles.fridgeDetectionLabel}>Detection Complete</Text>
              <Text style={styles.fridgeItemCount}>{FRIDGE_ITEMS.length} Items Found</Text>
            </View>
            <View style={styles.fridgeAddBtn}>
              <Ionicons name="add" size={16} color={C.charcoal} />
            </View>
          </Animated.View>

          <View style={styles.fridgeItemsList}>
            {FRIDGE_ITEMS.map((item, i) => (
              <Animated.View key={item.name} style={[styles.fridgeItemRow, itemStyles[i]]}>
                <View style={[styles.fridgeItemThumb, { backgroundColor: item.bg }]}>
                  <ExpoImage source={item.image} style={styles.fridgeItemThumbImg} contentFit="cover" />
                </View>
                <View style={styles.fridgeItemInfo}>
                  <Text style={styles.fridgeItemName}>{item.name}</Text>
                  <View style={styles.fridgeItemMeta}>
                    <View style={styles.fridgeQtyBadge}>
                      <Text style={styles.fridgeQtyText}>{item.qty}</Text>
                    </View>
                    <View style={styles.fridgeConfBadge}>
                      <Text style={styles.fridgeConfText}>{item.confidence}%</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>

          <Animated.View style={[styles.fridgeFindBtn, findBtnStyle]}>
            <Ionicons name="sparkles" size={14} color="#FFF" />
            <Text style={styles.fridgeFindBtnText}>Find Recipes</Text>
            <Animated.View style={[styles.fridgeFindTap, findTapStyle]} />
          </Animated.View>
        </Animated.View>
      </View>
    </PhoneSceneShell>
  );
}

const SLIDES: SlideConfig[] = [
  {
    id: 'extract-recipe',
    title: 'Save recipes from anywhere',
    description: 'Paste a TikTok, Instagram, or any link and get a clean recipe instantly.',
    Scene: ExtractScene,
  },
  {
    id: 'fridge-scan',
    title: 'What\'s in your fridge?',
    description: 'Snap a photo and get recipe ideas based on what you already have.',
    Scene: FridgeScene,
  },
  {
    id: 'step-card',
    title: 'Cook hands-free',
    description: 'Follow step-by-step cards with built-in timers while you cook.',
    Scene: CookStepScene,
  },
  {
    id: 'ai-chef',
    title: 'Your personal AI Chef',
    description: 'Get instant substitutions, cooking tips, and recipe ideas on demand.',
    Scene: AIChefScene,
  },
  {
    id: 'grocery',
    title: 'Smart grocery lists',
    description: 'Add ingredients in one tap and check them off as you shop.',
    Scene: GroceryListScene,
  },
  {
    id: 'chat-board',
    title: 'Share recipes and meal plans',
    description: 'Send recipe cards and meal plans to friends and family.',
    Scene: ChatBoardScene,
  },
];

function OnboardingSlide({
  slide,
  slideIndex,
  activeIndex,
  pageWidth,
  scrollX,
}: {
  slide: SlideConfig;
  slideIndex: number;
  activeIndex: number;
  pageWidth: number;
  scrollX: SharedValue<number>;
}) {
  const input = [(slideIndex - 1) * pageWidth, slideIndex * pageWidth, (slideIndex + 1) * pageWidth];

  const sceneStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollX.value, input, [0.93, 1, 0.93], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollX.value, input, [16, 0, 16], Extrapolation.CLAMP) - CARD_LIFT_Y },
    ],
    opacity: interpolate(scrollX.value, input, [0.4, 1, 0.4], Extrapolation.CLAMP),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, input, [0.22, 1, 0.22], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, input, [14, 0, 14], Extrapolation.CLAMP) }],
  }));

  const Scene = slide.Scene;

  return (
    <View style={[styles.slide, { width: pageWidth }]}>
      <View style={styles.slideInner}>
        <View style={styles.firstSlideLayer}>
          <Animated.View style={[styles.sceneStack, styles.firstSlideSceneStack, sceneStyle]}>
            <View style={styles.sceneFrame}>
              <Scene
                scrollX={scrollX}
                slideIndex={slideIndex}
                pageWidth={pageWidth}
                isActive={activeIndex === slideIndex}
              />
            </View>
          </Animated.View>

          <LinearGradient
            colors={['rgba(245, 241, 235, 0.96)', 'rgba(245, 241, 235, 0.82)', 'rgba(245, 241, 235, 0.4)', 'rgba(245, 241, 235, 0)']}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.firstSlideCardShade}
            pointerEvents="none"
          />

          <Animated.View style={[styles.firstCardTextWrap, textStyle]}>
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              ellipsizeMode="tail"
            >
              {slide.title}
            </Text>
            <Text style={styles.subtitle}>{slide.description}</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function ScrollProgress({
  pageWidth,
  scrollX,
  totalSlides,
}: {
  pageWidth: number;
  scrollX: SharedValue<number>;
  totalSlides: number;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: interpolate(
      scrollX.value,
      [0, Math.max((totalSlides - 1) * pageWidth, 1)],
      [28, 176],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={styles.scrollProgressTrack}>
      <Animated.View style={[styles.scrollProgressFill, fillStyle]} />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width, 1);

  const listRef = useRef<FlatList<SlideConfig>>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: activeIndex * pageWidth, animated: false });
  }, [activeIndex, pageWidth]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const bounded = Math.max(0, Math.min(next, SLIDES.length - 1));
      setActiveIndex(bounded);
    },
    [pageWidth]
  );

  const goToSlide = useCallback(
    (nextIndex: number) => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    },
    []
  );

  const renderSlide = useCallback(
    ({ item, index }: { item: SlideConfig; index: number }) => (
      <OnboardingSlide
        key={item.id}
        slide={item}
        slideIndex={index}
        activeIndex={activeIndex}
        pageWidth={pageWidth}
        scrollX={scrollX}
      />
    ),
    [activeIndex, pageWidth, scrollX]
  );

  const handleNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      goToSlide(activeIndex + 1);
      return;
    }

    router.replace('/paywall?fromOnboarding=1');
  }, [activeIndex, goToSlide, router]);

  const handleBack = useCallback(() => {
    if (activeIndex === 0) return;
    goToSlide(activeIndex - 1);
  }, [activeIndex, goToSlide]);

  const handleSkip = useCallback(() => {
    router.replace('/paywall?fromOnboarding=1');
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }]}>
      <StatusBar barStyle="dark-content" />

      <ExpoImage source={ONBOARDING_BG} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.14)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView intensity={1} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(245, 241, 235, 0.94)', 'rgba(245, 241, 235, 0.78)', 'rgba(245, 241, 235, 0.46)', 'rgba(245, 241, 235, 0.14)']}
        locations={[0, 0.28, 0.66, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={styles.pageBottomFade}
        pointerEvents="none"
      />

      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          disabled={activeIndex === 0}
          style={({ pressed }) => [
            styles.topButton,
            activeIndex === 0 && styles.topButtonHidden,
            pressed && activeIndex > 0 && styles.topButtonPressed,
          ]}
        >
          <Text style={styles.topButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}
        >
          <Text style={styles.topButtonText}>Skip</Text>
        </Pressable>
      </View>

      <AnimatedFlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
        initialNumToRender={SLIDES.length}
        windowSize={3}
        contentContainerStyle={styles.scrollContent}
      />

      <View style={[styles.footer, styles.footerOnFade]}>
        <ScrollProgress pageWidth={pageWidth} scrollX={scrollX} totalSlides={SLIDES.length} />

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
        >
          <LinearGradient
            colors={['#2C5A45', '#214635']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <View style={styles.primaryButtonInnerStroke} />
            <Text style={styles.primaryButtonText}>
              {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1EB',
  },
  topBar: {
    paddingHorizontal: 12,
    marginHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.52)',
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  topButton: {
    minWidth: 58,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.glassStrong,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  topButtonHidden: {
    opacity: 0,
  },
  topButtonPressed: {
    opacity: 0.72,
  },
  topButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
    fontSize: 14,
  },
  scrollContent: {
    alignItems: 'stretch',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 20,
  },
  slideInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  sceneStack: {
    width: '100%',
    maxWidth: 312,
    height: 540,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstSlideLayer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  firstSlideSceneStack: {
    width: '100%',
    zIndex: 1,
  },
  pageBottomFade: {
    ...StyleSheet.absoluteFillObject,
  },
  firstSlideCardShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    bottom: 0,
    zIndex: 2,
  },
  firstCardTextWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 130,
    zIndex: 3,
    alignItems: 'center',
  },
  sceneFrame: {
    width: '100%',
    height: '100%',
  },
  sceneRoot: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardFrameOuter: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    padding: 12,
    paddingBottom: 140,
    marginBottom: -70,
    overflow: 'hidden',
    ...SHADOW_SOFT,
  },
  boardFrameGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    fontSize: 27,
    lineHeight: 32,
    textAlign: 'center',
    letterSpacing: -0.3,
    maxWidth: 346,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.56)',
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  footerOnFade: {
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  scrollProgressTrack: {
    alignSelf: 'center',
    width: 176,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 21, 16, 0.1)',
    overflow: 'hidden',
  },
  scrollProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.gold,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#1A2D24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonGradient: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  primaryButtonInnerStroke: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  primaryPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  primaryButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.1,
  },

  // Shared mock frame
  mockScreenFrame: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: 'rgba(249, 244, 236, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    overflow: 'hidden',
  },

  // Slide 1
  mockHeaderRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
  },
  mockHeaderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.glassStrong,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  mockRecipeName: {
    fontSize: 10,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.muted,
    letterSpacing: 1.4,
  },
  mockStepCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: C.ivory,
    padding: 14,
    ...SHADOW_SOFT,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  mockStepWatermark: {
    position: 'absolute',
    top: 10,
    right: 12,
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: 'rgba(212, 175, 55, 0.18)',
  },
  mockStepBadge: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    marginBottom: 10,
  },
  mockStepBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.gold,
    letterSpacing: 1.1,
  },
  mockStepInstruction: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 10,
    paddingRight: 30,
  },
  mockTipContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: C.cardBg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  mockTipBar: {
    width: 3,
    backgroundColor: C.gold,
  },
  mockTipText: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },
  mockStepMetaRow: {
    marginBottom: 8,
  },
  mockTimerState: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  mockTimerCard: {
    position: 'relative',
    borderRadius: 14,
    padding: 10,
    backgroundColor: C.ivory,
    borderWidth: 1.3,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  mockTimerIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockTimerLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.muted,
    letterSpacing: 1,
  },
  mockTimerValue: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.charcoal,
    letterSpacing: -0.2,
  },
  mockStartButtonWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockStartRing: {
    position: 'absolute',
    width: 62,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198, 110, 78, 0.28)',
  },
  mockStartButton: {
    borderRadius: 11,
    backgroundColor: C.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mockStartButtonText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  mockTapCircle: {
    position: 'absolute',
    right: 30,
    bottom: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 21, 16, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.06)',
  },

  mockIngredientsDivider: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    marginBottom: 10,
  },
  mockIngredientsLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.gold,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  mockIngredientsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mockIngredientItem: {
    flex: 1,
    alignItems: 'center',
  },
  mockIngredientImageWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  mockIngredientImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  mockIngredientName: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    textAlign: 'center',
  },
  mockIngredientAmount: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    textAlign: 'center',
  },

  // Slide 2
  grocerySceneCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 12,
    gap: 10,
    ...SHADOW_SOFT,
  },
  groceryHeader: {
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    paddingHorizontal: 2,
  },
  groceryProgressWrap: {
    gap: 5,
  },
  groceryProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groceryProgressText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  groceryProgressPercent: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  groceryDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  groceryDoneBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
  },
  groceryProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.hairline,
    overflow: 'hidden',
  },
  groceryProgressBar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: C.gold,
  },
  groceryQuickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 23,
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.06)',
    paddingLeft: 12,
    paddingRight: 5,
  },
  groceryQuickAddText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  groceryQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groceryMicBtnWrap: {
    position: 'relative',
  },
  groceryMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(198, 110, 78, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryMicTap: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 21, 16, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.06)',
  },
  groceryWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 12,
  },
  groceryWaveBar: {
    width: 2,
    height: 12,
    borderRadius: 2,
    backgroundColor: C.terracotta,
  },
  groceryWaveBarSmall: {
    height: 7,
  },
  groceryWaveBarMedium: {
    height: 10,
  },
  groceryWaveBarTall: {
    height: 12,
  },
  groceryAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryAddBtnText: {
    color: C.ivory,
    fontSize: 20,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  groceryVoiceContainer: {
    backgroundColor: C.ivory,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.terracotta,
    padding: 10,
    gap: 6,
  },
  groceryVoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groceryVoiceLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  groceryVoiceClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryVoiceTranscriptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  groceryVoiceTranscript: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    fontStyle: 'italic',
  },
  groceryCheckedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  groceryCheckedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryCheckedTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  groceryCheckedCount: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  grocerySectionCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.hairline,
    backgroundColor: C.ivory,
  },
  groceryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  groceryItemThumb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.cardBg,
    overflow: 'hidden',
  },
  groceryItemThumbImage: {
    width: '100%',
    height: '100%',
  },
  groceryItemText: {
    flex: 1,
  },
  groceryItemName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  groceryItemAmount: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 1,
  },
  groceryCheckbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.15)',
    backgroundColor: C.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryCheckboxChecked: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  groceryCheckboxMark: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  groceryItemDivider: {
    height: 0.5,
    marginLeft: 57,
    backgroundColor: C.hairline,
  },

  // Slide 3
  chatSceneWrap: {
    flex: 1,
  },
  chatMsgListLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    gap: 8,
  },
  chatMsgListTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginBottom: 2,
  },
  chatSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 17,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 12,
    gap: 7,
  },
  chatSearchText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  chatConvItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 9,
    position: 'relative',
    overflow: 'hidden',
  },
  chatConvItemUnread: {
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  chatConvAvatarWrap: {
    position: 'relative',
  },
  chatConvUnreadDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
    borderWidth: 1.5,
    borderColor: C.ivory,
  },
  chatConvFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatRowNameBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  chatRowTimeUnread: {
    color: C.gold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  chatTapCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    borderRadius: 25,
    backgroundColor: 'rgba(198, 110, 78, 0.12)',
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  chatRowContent: {
    flex: 1,
  },
  chatRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatGroupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  chatRowName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  chatGroupTag: {
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chatGroupTagText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
  },
  chatRowTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  chatRowMessage: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    flex: 1,
  },
  chatUnreadBadge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: C.gold,
    marginLeft: 6,
  },
  chatUnreadBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  chatViewLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chatViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
    gap: 7,
  },
  chatViewHeaderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatViewHeaderAvatarText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  chatViewHeaderName: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    letterSpacing: -0.2,
  },
  chatViewHeaderSub: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B8E23',
  },
  chatViewBody: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 6,
  },
  chatBubbleLeft: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    borderRadius: 14,
    borderTopLeftRadius: 5,
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...SHADOW_SOFT,
    shadowOpacity: 0.03,
  },
  chatBubbleText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    lineHeight: 15,
  },
  chatRecipeCard: {
    alignSelf: 'flex-start',
    width: '80%',
    backgroundColor: C.ivory,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
    shadowOpacity: 0.04,
  },
  chatRecipeImg: {
    height: 52,
    justifyContent: 'space-between',
    padding: 7,
    overflow: 'hidden',
  },
  chatRecipePhoto: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  chatRecipeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.gold,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  chatRecipeBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  chatRecipeTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(26, 21, 16, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    alignSelf: 'flex-end',
  },
  chatRecipeTimeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
  chatRecipeContent: {
    padding: 8,
    gap: 3,
  },
  chatRecipeTitle: {
    fontSize: 12,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  chatRecipeDifficulty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatRecipeDiffDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chatRecipeDiffText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  chatRecipeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chatRecipeActionText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  chatMealPlanCard: {
    alignSelf: 'flex-start',
    width: '80%',
    backgroundColor: C.ivory,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
    shadowOpacity: 0.04,
  },
  chatMpHeader: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 1,
  },
  chatMpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  chatMpBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
  },
  chatMpTitle: {
    fontSize: 12,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  chatMpSubtitle: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  chatMpBody: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  chatMpMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatMpAccent: {
    width: 2.5,
    height: 12,
    borderRadius: 1.25,
  },
  chatMpMealLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
    width: 48,
  },
  chatMpMealName: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  chatMpActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
  },
  chatMpViewBtn: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  chatMpViewText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  chatMpSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  chatMpSaveText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 17,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingLeft: 12,
    paddingRight: 3,
    marginHorizontal: 10,
    marginBottom: 6,
  },
  chatComposerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  chatSendBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Slide 5 — AI Chef
  aiSceneWrap: {
    flex: 1,
  },
  aiRecipePeek: {
    padding: 12,
    gap: 4,
  },
  aiRecipeImgPeek: {
    height: 60,
    borderRadius: 14,
    overflow: 'hidden',
  },
  aiRecipePhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  aiRecipeTitle: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginTop: 6,
  },
  aiRecipeDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
  },
  aiPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  aiActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 21, 16, 0.1)',
    backgroundColor: C.glass,
    position: 'relative',
    overflow: 'hidden',
  },
  aiActionPillAsk: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  aiActionPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    letterSpacing: 0.5,
  },
  aiAskPillWrap: {
    flex: 1,
    position: 'relative',
  },
  aiAskPressRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.28)',
  },
  aiHandCircle: {
    position: 'absolute',
    bottom: -18,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 21, 16, 0.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.06)',
  },
  aiSheetLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 130,
    backgroundColor: C.ivory,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
    shadowOffset: { width: 0, height: -4 },
  },
  aiSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  aiSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  aiSheetTitle: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  aiInspirationRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  aiInspPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  aiInspPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  aiChatArea: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  aiUserBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderRadius: 16,
    borderTopRightRadius: 4,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  aiUserBubbleText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  aiTypingDots: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
    opacity: 0.5,
  },
  aiResponseCard: {
    alignSelf: 'flex-start',
    width: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    ...SHADOW_SOFT,
    shadowOpacity: 0.03,
    gap: 4,
  },
  aiResponseBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  aiResponseBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
  },
  aiResponseTitle: {
    fontSize: 13,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  aiResponseMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  aiResponseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiResponseMetaText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  aiResponseSubtext: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  aiResponseAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  aiResponseActionText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  aiSaveRow: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  aiSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  aiSaveBtnText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },

  // Slide — Extract Recipe
  extSceneWrap: {
    flex: 1,
  },
  extInputLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    gap: 10,
  },
  extInputHeader: {
    gap: 2,
  },
  extInputTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  extInputSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  extPlatformRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  extPlatformIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extUrlField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 12,
  },
  extUrlText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    flex: 1,
  },
  extDetectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(228, 64, 95, 0.08)',
  },
  extDetectedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  extExtractBtn: {
    height: 40,
    borderRadius: 20,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 4,
  },
  extExtractBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  extExtractTap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  extExtractLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    gap: 12,
  },
  extThumbWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  extThumb: {
    height: 110,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extAiBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  extAiBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  extExtractTitle: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  extExtractSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 2,
  },
  extSkeletonWrap: {
    gap: 8,
    marginTop: 4,
  },
  extSkeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
  },
  extResultLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
  },
  extResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  extCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extResultTitle: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  extResultSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  extRecipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
    shadowOpacity: 0.04,
    gap: 6,
  },
  extRecipeName: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  extRecipeMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  extRecipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  extRecipeMetaText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  extSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  extSourceText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  extIngredientsWrap: {
    marginTop: 4,
    gap: 5,
  },
  extIngredientsLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
    letterSpacing: 1,
  },
  extIngRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extIngDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  extIngText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  extIngMore: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.terracotta,
    marginTop: 2,
  },
  extBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  extDiscardBtn: {
    flex: 0.4,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.hairline,
  },
  extDiscardText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  extSaveBtn: {
    flex: 0.6,
    flexDirection: 'row',
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.terracotta,
  },
  extSaveBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Slide — Fridge Scan
  fridgeSceneWrap: {
    flex: 1,
  },

  // Home screen layer
  fridgeHomeLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    zIndex: 2,
  },
  fridgeHomeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fridgeHomeUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fridgeHomeAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeHomeAvatarText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  fridgeHomeGreeting: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    letterSpacing: 0.5,
  },
  fridgeHomeName: {
    fontSize: 13,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginTop: -1,
  },
  fridgeHomeAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeHomeSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 10,
  },
  fridgeHomeSearchText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  fridgeHomePillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  fridgeHomePill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
    ...SHADOW_SOFT,
    shadowOpacity: 0.04,
    position: 'relative',
    overflow: 'hidden',
  },
  fridgeHomePillIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeHomePillLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    letterSpacing: 0.1,
  },
  fridgeHomePillTap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    borderRadius: 30,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  fridgeHomeSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  fridgeHomeSectionTitle: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  fridgeHomeSectionLink: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  fridgeHomeRecentPlaceholder: {
    flexDirection: 'row',
    gap: 8,
  },
  fridgeHomeRecentCard: {
    flex: 1,
    height: 80,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
  },

  // Camera layer
  fridgeBgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fridgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },

  // Camera UI
  fridgeCamTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    zIndex: 3,
  },
  fridgeCamBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeCamTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fridgeViewfinder: {
    position: 'absolute',
    top: '15%',
    left: '12%',
    right: '12%',
    bottom: '22%',
    zIndex: 3,
  },
  fridgeCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  fridgeCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 6,
  },
  fridgeCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 6,
  },
  fridgeCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 6,
  },
  fridgeCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 6,
  },
  fridgeCamBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 14,
    paddingTop: 10,
    zIndex: 3,
  },
  fridgeCamGallery: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeShutterWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeShutterOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeShutterInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
  },
  fridgeShutterTap: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  fridgeCamFlip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 4,
  },

  // Scan phase
  fridgeScanBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  fridgeScanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  fridgeScanBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  fridgeMarkerPos: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
    marginTop: -12,
  },
  fridgePulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(198, 110, 78, 0.4)',
  },
  fridgeMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: C.terracotta,
  },

  // Results sheet
  fridgeSheetLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
    backgroundColor: C.ivory,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...SHADOW_SOFT,
    shadowOffset: { width: 0, height: -4 },
    padding: 10,
  },
  fridgeSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  fridgeSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  fridgeDetectionLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  fridgeItemCount: {
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  fridgeAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.cardBg,
    borderWidth: 0.5,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeItemsList: {
    gap: 6,
  },
  fridgeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 12,
    padding: 8,
    gap: 8,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  fridgeItemThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeItemThumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  fridgeItemInfo: {
    flex: 1,
    gap: 2,
  },
  fridgeItemName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  fridgeItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fridgeQtyBadge: {
    backgroundColor: 'rgba(107, 142, 35, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fridgeQtyText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#6B8E23',
  },
  fridgeConfBadge: {
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fridgeConfText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  fridgeFindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.terracotta,
    marginTop: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  fridgeFindBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  fridgeFindTap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
