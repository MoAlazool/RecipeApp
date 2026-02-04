import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - 40;
const FAB_SIZE = 56;

type IconName = keyof typeof Ionicons.glyphMap;

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

interface FloatingBottomNavProps {
  activeTab: string;
  onTabPress: (key: string) => void;
  onFabPress: () => void;
  items?: NavItem[];
  fabIcon?: IconName;
  primaryColor?: string;
  backgroundColor?: string;
}

const DEFAULT_ITEMS: NavItem[] = [
  { key: 'recipes', label: 'Recipes', icon: 'home-outline', iconActive: 'home' },
  { key: 'shopping', label: 'Shopping', icon: 'cart-outline', iconActive: 'cart' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Individual Tab Item Component
interface TabItemProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  primaryColor: string;
}

const TabItem: React.FC<TabItemProps> = ({ item, isActive, onPress, primaryColor }) => {
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [isActive]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      activeProgress.value,
      [0, 1],
      [0.5, 1],
      Extrapolation.CLAMP
    );
    const itemScale = interpolate(
      activeProgress.value,
      [0, 1],
      [1, 1.1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: scale.value * itemScale }],
    };
  });

  const iconColor = isActive ? primaryColor : '#8E8E93';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabItem, animatedStyle]}
    >
      <Ionicons
        name={isActive ? item.iconActive : item.icon}
        size={24}
        color={iconColor}
      />
      <Text style={[styles.tabLabel, { color: iconColor }]}>{item.label}</Text>
    </AnimatedPressable>
  );
};

// Floating Action Button Component
interface FabButtonProps {
  onPress: () => void;
  icon: IconName;
  primaryColor: string;
}

const FabButton: React.FC<FabButtonProps> = ({ onPress, icon, primaryColor }) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.85, {
      damping: 10,
      stiffness: 400,
      mass: 0.5,
    });
    rotate.value = withSpring(45, {
      damping: 12,
      stiffness: 200,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 8,
      stiffness: 300,
      overshootClamping: false,
    });
    rotate.value = withSpring(0, {
      damping: 12,
      stiffness: 200,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const shadowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scale.value, [0.85, 1], [0.9, 1]) }],
    opacity: interpolate(scale.value, [0.85, 1], [0.3, 0.5]),
  }));

  return (
    <View style={styles.fabContainer}>
      <Animated.View
        style={[
          styles.fabShadow,
          { backgroundColor: primaryColor },
          shadowAnimatedStyle,
        ]}
      />
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.fab, { backgroundColor: primaryColor }, animatedStyle]}
      >
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </AnimatedPressable>
    </View>
  );
};

// Main Floating Bottom Nav Component
export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = ({
  activeTab,
  onTabPress,
  onFabPress,
  items = DEFAULT_ITEMS,
  fabIcon = 'add',
  primaryColor = '#007AFF',
  backgroundColor = '#FFFFFF',
}) => {
  const insets = useSafeAreaInsets();
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2, 4);

  const handleTabPress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabPress(key);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Main pill-shaped bar */}
      <View style={[styles.pillBar, { backgroundColor }]}>
        {/* Left side tabs */}
        <View style={styles.tabGroup}>
          {leftItems.map((item) => (
            <TabItem
              key={item.key}
              item={item}
              isActive={activeTab === item.key}
              onPress={() => handleTabPress(item.key)}
              primaryColor={primaryColor}
            />
          ))}
        </View>

        {/* Center spacer for FAB */}
        <View style={styles.fabSpacer} />

        {/* Right side tabs */}
        <View style={styles.tabGroup}>
          {rightItems.map((item) => (
            <TabItem
              key={item.key}
              item={item}
              isActive={activeTab === item.key}
              onPress={() => handleTabPress(item.key)}
              primaryColor={primaryColor}
            />
          ))}
        </View>
      </View>

      {/* Center FAB - positioned absolutely */}
      <FabButton onPress={onFabPress} icon={fabIcon} primaryColor={primaryColor} />
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
    paddingHorizontal: 20,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: TAB_BAR_WIDTH,
    height: 72,
    borderRadius: 36,
    paddingHorizontal: 12,
    // iOS-style soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-evenly',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.1,
  },
  fabSpacer: {
    width: FAB_SIZE + 16,
  },
  fabContainer: {
    position: 'absolute',
    top: -FAB_SIZE / 2 + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle inner shadow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabShadow: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    top: 8,
  },
});

export default FloatingBottomNav;
