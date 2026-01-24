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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type IconName = keyof typeof Ionicons.glyphMap;

// Layout constants
const BAR_HEIGHT = 74;
const BAR_MARGIN = 16;
const BAR_RADIUS = 37;

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
      <GlassView
        isInteractive
        glassEffectStyle="clear"
        tintColor="rgba(255,255,255,0.35)"
        style={[style, styles.glassSurface]}
      >
        <View pointerEvents="none" style={styles.glassHighlight} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.glassSheen}
        />
        <View pointerEvents="none" style={styles.glassInnerShadow} />
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint="systemMaterial"
      intensity={Platform.OS === 'ios' ? 55 : 85}
      style={[style, styles.glassSurface, styles.fallbackSurface]}
    >
      <View pointerEvents="none" style={styles.glassHighlight} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.glassSheen}
      />
      <View pointerEvents="none" style={styles.glassInnerShadow} />
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
  const [containerWidth, setContainerWidth] = React.useState(0);
  const contentPadding = 8;
  const activeRouteName = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, TAB_ORDER.indexOf(activeRouteName ?? ''));
  const activeAnim = React.useRef(new Animated.Value(activeIndex)).current;
  const tabWidth =
    containerWidth > 0
      ? (containerWidth - contentPadding * 2) / TAB_ORDER.length
      : 0;
  const indicatorTranslate = Animated.add(
    Animated.multiply(activeAnim, tabWidth),
    contentPadding
  );

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

  React.useEffect(() => {
    if (!containerWidth) return;
    Animated.spring(activeAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeIndex, containerWidth, tabWidth, activeAnim]);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.barContainer}>
        <AdaptiveGlass style={styles.glass}>
          <View
            style={styles.tabsContainer}
            onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
          >
            {tabWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeIndicator,
                  { width: tabWidth, transform: [{ translateX: indicatorTranslate }] },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={[styles.activeTint, { backgroundColor: primaryColor }]}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.activeIndicatorBorder} />
              </Animated.View>
            )}
            {TAB_ORDER.map((routeName) => {
              const config = TAB_CONFIG[routeName];
              if (!config) return null;

              const isActive = state.routes[state.index]?.name === routeName;
              const tabIndex = TAB_ORDER.indexOf(routeName);
              const progress = activeAnim.interpolate({
                inputRange: [tabIndex - 1, tabIndex, tabIndex + 1],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              });
              const iconScale = progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
                extrapolate: 'clamp',
              });
              const iconLift = progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
                extrapolate: 'clamp',
              });
              const labelOpacity = progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
                extrapolate: 'clamp',
              });

              return (
                <Pressable
                  key={routeName}
                  onPress={() => handleTabPress(routeName)}
                  style={({ pressed }) => [
                    styles.tabItem,
                    pressed && styles.tabItemPressed,
                  ]}
                >
                  <Animated.View style={[styles.tabIconWrap, { transform: [{ translateY: iconLift }, { scale: iconScale }] }]}>
                    <Ionicons
                      name={isActive ? config.iconActive : config.icon}
                      size={24}
                      color={isActive ? primaryColor : 'rgba(60,60,67,0.5)'}
                    />
                  </Animated.View>
                  <Animated.Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive ? primaryColor : 'rgba(60,60,67,0.5)',
                        opacity: labelOpacity,
                      },
                    ]}
                  >
                    {config.label}
                  </Animated.Text>
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
    boxShadow: '0 16px 28px rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  glass: {
    flex: 1,
  },
  glassSurface: {
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  fallbackSurface: {
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.38)',
      android: 'rgba(255,255,255,0.85)',
      default: 'rgba(255,255,255,0.7)',
    }),
  },
  glassHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glassSheen: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: '70%',
    borderRadius: BAR_RADIUS,
  },
  glassInnerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
    borderWidth: 0.6,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabItemPressed: {
    opacity: 0.6,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  activeTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  activeIndicatorBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default FloatingTabBar;
