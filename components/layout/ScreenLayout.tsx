import React from 'react';
import { View, StyleSheet, ViewStyle, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useScreenLayout } from '@/hooks/useScreenLayout';

interface ScreenLayoutProps {
  children: React.ReactNode;
  /** Whether this screen has the floating tab bar */
  hasTabBar?: boolean;
  /** Additional top padding for header */
  headerPadding?: number;
  /** Background color */
  backgroundColor?: string;
  /** Additional container styles */
  style?: ViewStyle;
  /** Enable keyboard avoiding behavior */
  keyboardAvoiding?: boolean;
}

/**
 * Base screen layout component with safe area handling.
 *
 * @example
 * // For a detail/modal screen
 * <ScreenLayout hasTabBar={false}>
 *   <Header />
 *   <Content />
 *   <BottomNavigation />
 * </ScreenLayout>
 *
 * @example
 * // For a tab screen
 * <ScreenLayout hasTabBar>
 *   <Header />
 *   <ScrollableContent />
 * </ScreenLayout>
 */
export function ScreenLayout({
  children,
  hasTabBar = false,
  headerPadding,
  backgroundColor = '#F8F6F5',
  style,
  keyboardAvoiding = false,
}: ScreenLayoutProps) {
  const layout = useScreenLayout({ hasTabBar, headerPadding });

  const Container = keyboardAvoiding ? KeyboardAvoidingView : View;
  const containerProps = keyboardAvoiding
    ? { behavior: Platform.OS === 'ios' ? 'padding' as const : undefined }
    : {};

  return (
    <Container
      style={[styles.container, { backgroundColor }, style]}
      {...containerProps}
    >
      {children}
    </Container>
  );
}

interface ScreenHeaderProps {
  children: React.ReactNode;
  /** Additional top padding beyond safe area */
  extraPadding?: number;
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * Screen header with safe area top padding.
 *
 * @example
 * <ScreenHeader>
 *   <Text>Cooking Mode</Text>
 *   <CloseButton />
 * </ScreenHeader>
 */
export function ScreenHeader({ children, extraPadding = 12, style }: ScreenHeaderProps) {
  const layout = useScreenLayout({ headerPadding: extraPadding });

  return (
    <View style={[styles.header, layout.headerStyle, style]}>
      {children}
    </View>
  );
}

interface ScreenContentProps {
  children: React.ReactNode;
  /** Whether screen has tab bar (affects bottom padding) */
  hasTabBar?: boolean;
  /** Use ScrollView wrapper */
  scrollable?: boolean;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Additional styles for content (applies to inner content) */
  contentContainerStyle?: ViewStyle;
}

/**
 * Screen content area with proper bottom padding.
 *
 * @example
 * // Non-scrollable content
 * <ScreenContent hasTabBar={false}>
 *   <StepCard />
 * </ScreenContent>
 *
 * @example
 * // Scrollable content
 * <ScreenContent scrollable hasTabBar>
 *   <RecipeList />
 * </ScreenContent>
 */
export function ScreenContent({
  children,
  hasTabBar = false,
  scrollable = false,
  style,
  contentContainerStyle,
}: ScreenContentProps) {
  const layout = useScreenLayout({ hasTabBar });

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.content, style]}
        contentContainerStyle={[layout.scrollContentStyle, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  );
}

interface ScreenFooterProps {
  children: React.ReactNode;
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * Fixed bottom footer with safe area padding.
 * Use for navigation buttons, action bars, etc.
 *
 * @example
 * <ScreenFooter>
 *   <PreviousButton />
 *   <NextButton />
 * </ScreenFooter>
 */
export function ScreenFooter({ children, style }: ScreenFooterProps) {
  const layout = useScreenLayout();

  return (
    <View style={[styles.footer, layout.fixedBottomStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0E6E2',
    backgroundColor: '#F8F6F5',
  },
});

export default ScreenLayout;
