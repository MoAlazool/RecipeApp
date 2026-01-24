import { useMemo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomTabBarHeight, SPACING } from '../constants/layout';

interface ScreenLayoutOptions {
  /** Whether this screen has the floating tab bar (tab screens) */
  hasTabBar?: boolean;
  /** Additional top padding beyond safe area */
  headerPadding?: number;
  /** Additional bottom padding beyond safe area/tab bar */
  contentPadding?: number;
}

interface ScreenLayoutResult {
  /** Raw safe area insets */
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Padding for header area (safe area top + extra padding) */
  headerPaddingTop: number;
  /** Padding for bottom content (accounts for tab bar or safe area) */
  contentPaddingBottom: number;
  /** Style object for header with paddingTop */
  headerStyle: ViewStyle;
  /** Style object for content with paddingBottom */
  contentStyle: ViewStyle;
  /** Style object for scrollable content container */
  scrollContentStyle: ViewStyle;
  /** Style object for fixed bottom container (e.g., navigation buttons) */
  fixedBottomStyle: ViewStyle;
}

/**
 * Hook for consistent screen layout with safe area handling.
 *
 * @param options - Configuration options
 * @returns Layout values and pre-computed styles
 *
 * @example
 * // For a tab screen (with floating nav bar)
 * const { headerStyle, scrollContentStyle } = useScreenLayout({ hasTabBar: true });
 *
 * @example
 * // For a non-tab screen (modal, detail screen)
 * const { headerStyle, fixedBottomStyle } = useScreenLayout({ hasTabBar: false });
 *
 * @example
 * // Cooking mode screen
 * const layout = useScreenLayout({ hasTabBar: false, headerPadding: 12 });
 *
 * <View style={styles.container}>
 *   <View style={[styles.header, layout.headerStyle]}>...</View>
 *   <ScrollView contentContainerStyle={layout.scrollContentStyle}>...</ScrollView>
 *   <View style={[styles.navigation, layout.fixedBottomStyle]}>...</View>
 * </View>
 */
export function useScreenLayout(options: ScreenLayoutOptions = {}): ScreenLayoutResult {
  const {
    hasTabBar = false,
    headerPadding = SPACING.md,
    contentPadding = SPACING.md,
  } = options;

  const insets = useSafeAreaInsets();

  return useMemo(() => {
    // Header padding: safe area top + extra padding
    const headerPaddingTop = insets.top + headerPadding;

    // Bottom padding depends on whether screen has tab bar
    const contentPaddingBottom = hasTabBar
      ? getBottomTabBarHeight(insets.bottom)
      : Math.max(insets.bottom, SPACING.lg) + contentPadding;

    // Fixed bottom padding (for navigation buttons at screen bottom)
    const fixedBottomPadding = Math.max(insets.bottom, SPACING.md);

    return {
      insets: {
        top: insets.top,
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
      },
      headerPaddingTop,
      contentPaddingBottom,
      headerStyle: {
        paddingTop: headerPaddingTop,
      },
      contentStyle: {
        paddingBottom: contentPaddingBottom,
      },
      scrollContentStyle: {
        paddingBottom: contentPaddingBottom,
      },
      fixedBottomStyle: {
        paddingBottom: fixedBottomPadding,
      },
    };
  }, [insets.top, insets.bottom, insets.left, insets.right, hasTabBar, headerPadding, contentPadding]);
}

/**
 * Simplified hook for non-tab screens that just need safe area values.
 *
 * @returns Safe area insets with convenient padding values
 *
 * @example
 * const { topPadding, bottomPadding } = useModalLayout();
 *
 * <View style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
 */
export function useModalLayout() {
  const insets = useSafeAreaInsets();

  return useMemo(() => ({
    insets,
    topPadding: insets.top + SPACING.md,
    bottomPadding: Math.max(insets.bottom, SPACING.lg),
    horizontalPadding: Math.max(insets.left, insets.right, SPACING.md),
  }), [insets]);
}

export default useScreenLayout;
