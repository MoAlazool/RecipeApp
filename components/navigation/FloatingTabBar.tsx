import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Text,
  StyleProp,
  ViewStyle,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type IconName = keyof typeof Ionicons.glyphMap;

// Layout constants
const BAR_HEIGHT = 56;
const BAR_MARGIN = 16;
const BAR_RADIUS = 28;

// Tab configuration (4 items - no add button)
const TAB_CONFIG: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Recipes', icon: 'book-outline', iconActive: 'book' },
  'ai-chef': { label: 'AI Chef', icon: 'sparkles-outline', iconActive: 'sparkles' },
  shopping: { label: 'Shopping', icon: 'cart-outline', iconActive: 'cart' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

const TAB_ORDER = ['index', 'ai-chef', 'shopping', 'profile'];

interface FloatingTabBarProps extends BottomTabBarProps {
  primaryColor?: string;
}

const AdaptiveGlass: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const hasNativeModule = !!(NativeModules as Record<string, unknown>).ExpoGlassEffect;
  const canUseGlass =
    Platform.OS === 'ios' &&
    hasNativeModule &&
    (() => {
      try {
        return isLiquidGlassAvailable();
      } catch {
        return false;
      }
    })();

  if (canUseGlass) {
    return (
      <GlassView isInteractive style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint="systemMaterial"
      intensity={Platform.OS === 'ios' ? 70 : 90}
      style={[style, styles.fallbackSurface]}
    >
      {children}
    </BlurView>
  );
};

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  navigation,
  primaryColor = '#E6482E',
}) => {
  const insets = useSafeAreaInsets();

  const handleTabPress = (routeName: string) => {
    const route = state.routes.find(r => r.name === routeName);
    if (!route) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const bottomPadding = Math.max(insets.bottom - 8, 8);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.barContainer}>
        <AdaptiveGlass style={styles.glass}>
          <View style={styles.tabsContainer}>
            {TAB_ORDER.map((routeName) => {
              const config = TAB_CONFIG[routeName];
              if (!config) return null;

              const isActive = state.routes[state.index]?.name === routeName;

              return (
                <Pressable
                  key={routeName}
                  onPress={() => handleTabPress(routeName)}
                  style={({ pressed }) => [
                    styles.tabItem,
                    pressed && styles.tabItemPressed,
                  ]}
                >
                  <Ionicons
                    name={isActive ? config.iconActive : config.icon}
                    size={22}
                    color={isActive ? primaryColor : 'rgba(60,60,67,0.5)'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? primaryColor : 'rgba(60,60,67,0.5)' },
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AdaptiveGlass>
        <View pointerEvents="none" style={styles.border} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: BAR_MARGIN,
  },
  barContainer: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.08)',
  },
  glass: {
    flex: 1,
  },
  fallbackSurface: {
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.55)',
      android: 'rgba(255,255,255,0.9)',
      default: 'rgba(255,255,255,0.75)',
    }),
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  tabItemPressed: {
    opacity: 0.6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default FloatingTabBar;
