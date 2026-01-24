import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_NAV, getBottomTabBarHeight } from '../constants/layout';

/**
 * Hook to get the height of the floating bottom tab bar
 * including safe area insets.
 *
 * Use this in any screen that needs to account for the
 * floating navigation bar when positioning content.
 *
 * @returns The total height needed to clear the bottom nav bar
 *
 * @example
 * ```tsx
 * const bottomTabBarHeight = useBottomTabBarHeight();
 *
 * <FlatList
 *   contentContainerStyle={{ paddingBottom: bottomTabBarHeight }}
 * />
 * ```
 */
export function useBottomTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return getBottomTabBarHeight(insets.bottom);
}

/**
 * Hook to get content container styles for scrollable content
 * that needs to account for the floating navigation bar.
 *
 * @returns Style object with paddingBottom
 *
 * @example
 * ```tsx
 * const bottomPadding = useBottomContentPadding();
 *
 * <ScrollView contentContainerStyle={bottomPadding}>
 *   ...
 * </ScrollView>
 * ```
 */
export function useBottomContentPadding() {
  const bottomTabBarHeight = useBottomTabBarHeight();
  return {
    paddingBottom: bottomTabBarHeight,
  };
}

/**
 * Hook to get the raw floating nav bar constants.
 * Useful when you need direct access to dimensions.
 *
 * @returns Floating nav bar constants and safe area
 */
export function useFloatingNavLayout() {
  const insets = useSafeAreaInsets();

  return {
    ...FLOATING_NAV,
    safeAreaBottom: insets.bottom,
    totalHeight: getBottomTabBarHeight(insets.bottom),
    barBottomPosition: Math.max(insets.bottom - 4, FLOATING_NAV.BASE_BOTTOM_PADDING),
  };
}

export default useBottomTabBarHeight;
