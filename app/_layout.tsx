import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@rneui/themed';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
} from '@expo-google-fonts/noto-sans';
import { useAuthStore } from '@/stores/authStore';
import {
  BackButton,
  RecipeHeaderRight,
  TranslucentHeaderBackground,
} from '@/components/navigation/RecipeHeader';
import { configureNotifications } from '@/services/notifications.service';

const theme = {
  lightColors: {
    primary: '#F2330D',
    secondary: '#556B2F',
    background: '#F8F6F5',
    white: '#FFFFFF',
    black: '#1C100D',
    grey0: '#F2EEEC',
    grey1: '#E8D3CE',
    grey2: '#C8B7B2',
    grey3: '#9C5749',
    grey4: '#6E4A42',
    grey5: '#3A2622',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  darkColors: {
    primary: '#F2330D',
    secondary: '#556B2F',
    background: '#221310',
    white: '#2F1B18',
    black: '#FFFFFF',
    grey0: '#2A1D1A',
    grey1: '#3D2A26',
    grey2: '#5B403A',
    grey3: '#9C5749',
    grey4: '#C8B7B2',
    grey5: '#E1E5D5',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  mode: 'light' as const,
};

export default function RootLayout() {
  const { initialize, isAuthenticated } = useAuthStore();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider theme={theme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth/index" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="recipe/[id]"
              options={{
                headerShown: true,
                headerTransparent: true,
                headerTitle: '',
                headerLeft: () => <BackButton />,
                headerRight: () => <RecipeHeaderRight />,
                headerBackground: () => <TranslucentHeaderBackground />,
              }}
            />
            <Stack.Screen
              name="cooking/[id]"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="add-recipe"
              options={{
                headerShown: true,
                title: 'Add Recipe',
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="fridge-scan"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="fridge-review"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="recipe-results"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="paywall"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
          </Stack>
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
