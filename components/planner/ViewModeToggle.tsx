import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { MealPlanViewMode } from '@/utils/types';

const C = {
  charcoal: '#1A1510',
  muted: '#8A8578',
  cardBg: '#F5F3EE',
};

const TOGGLE_WIDTH = 180;
const TOGGLE_HEIGHT = 36;
const SEGMENT_WIDTH = TOGGLE_WIDTH / 2;
const INDICATOR_INSET = 3;

interface ViewModeToggleProps {
  mode: MealPlanViewMode;
  onChangeMode: (mode: MealPlanViewMode) => Promise<boolean> | void;
}

export default function ViewModeToggle({ mode, onChangeMode }: ViewModeToggleProps) {
  const indicatorX = useSharedValue(mode === 'day' ? INDICATOR_INSET : SEGMENT_WIDTH);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const animateTo = (targetMode: MealPlanViewMode) => {
    indicatorX.value = withTiming(
      targetMode === 'day' ? INDICATOR_INSET : SEGMENT_WIDTH,
      { duration: 250, easing: Easing.out(Easing.cubic) }
    );
  };

  const handlePress = async (newMode: MealPlanViewMode) => {
    if (newMode === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = onChangeMode(newMode);
    if (result instanceof Promise) {
      const allowed = await result;
      if (allowed) {
        animateTo(newMode);
      }
    } else {
      animateTo(newMode);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        <Pressable style={styles.segment} onPress={() => handlePress('day')}>
          <Text
            style={[
              styles.label,
              mode === 'day' && styles.labelActive,
            ]}
          >
            Day
          </Text>
        </Pressable>
        <Pressable style={styles.segment} onPress={() => handlePress('week')}>
          <Text
            style={[
              styles.label,
              mode === 'week' && styles.labelActive,
            ]}
          >
            Week
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  container: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: 18,
    backgroundColor: C.cardBg,
    flexDirection: 'row',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_INSET,
    width: SEGMENT_WIDTH - INDICATOR_INSET * 2,
    height: TOGGLE_HEIGHT - INDICATOR_INSET * 2,
    borderRadius: 15,
    backgroundColor: C.charcoal,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
