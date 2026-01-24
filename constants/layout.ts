import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Floating Bottom Navigation Bar Constants
 *
 * These values define the layout of the floating navigation bar
 * and should be used consistently across all screens.
 */
export const FLOATING_NAV = {
  // Bar dimensions
  BAR_HEIGHT: 74,
  BAR_BORDER_RADIUS: 37,
  BAR_HORIZONTAL_MARGIN: 16,

  // Spacing from bottom of screen
  BASE_BOTTOM_PADDING: 8,

  // Content spacing
  CONTENT_BOTTOM_OFFSET: 80,
} as const;

/**
 * Calculate the total bottom inset needed for content
 * to not be hidden behind the floating navigation bar.
 *
 * @param safeAreaBottom - The bottom safe area inset from useSafeAreaInsets()
 * @returns The total bottom padding needed for content
 */
export function getBottomTabBarHeight(safeAreaBottom: number): number {
  // Bar bottom position from screen edge
  const barBottomPadding = Math.max(safeAreaBottom - 4, FLOATING_NAV.BASE_BOTTOM_PADDING);

  // Total height taken by nav bar + comfortable content padding
  return FLOATING_NAV.BAR_HEIGHT + barBottomPadding + 16;
}

/**
 * Get content container padding for scrollable content
 * that needs to account for the floating navigation bar.
 *
 * @param safeAreaBottom - The bottom safe area inset
 * @returns Object with paddingBottom value
 */
export function getContentPadding(safeAreaBottom: number) {
  return {
    paddingBottom: getBottomTabBarHeight(safeAreaBottom),
  };
}

// Screen dimensions
export const SCREEN = {
  WIDTH: SCREEN_WIDTH,
  HEIGHT: SCREEN_HEIGHT,
  IS_SMALL: SCREEN_HEIGHT < 700,
  IS_LARGE: SCREEN_HEIGHT > 800,
} as const;

// Common spacing values
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Common border radius values
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;
