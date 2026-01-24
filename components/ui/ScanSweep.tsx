import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface ScanSweepProps {
  active?: boolean;
  tintColor?: string;
}

const LINE_HEIGHT = 2;
const GLOW_HEIGHT = 26;

export function ScanSweep({ active = true, tintColor = '#F2330D' }: ScanSweepProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!active || height <= 0) return;

    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [active, height, progress]);

  const travel = Math.max(height - GLOW_HEIGHT, 0);
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travel],
  });

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: tintColor,
            transform: [{ translateY }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          {
            backgroundColor: tintColor,
            transform: [{ translateY }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: GLOW_HEIGHT,
    opacity: 0.14,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: LINE_HEIGHT,
    opacity: 0.6,
  },
});

export default ScanSweep;
