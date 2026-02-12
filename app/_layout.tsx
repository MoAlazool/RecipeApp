import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@rneui/themed';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MenuProvider } from 'react-native-popup-menu';
import * as Notifications from 'expo-notifications';
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
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
} from '@expo-google-fonts/playfair-display';
import { useAuthStore } from '@/stores/authStore';
import { useMessagingStore } from '@/stores/messagingStore';
import { useUsageStore } from '@/stores/usageStore';
import { firebaseService } from '@/services/firebase.service';
import { revenueCatService } from '@/services/revenueCat.service';
import {
  configureNotifications,
  showMessageNotification,
  registerForPushNotifications,
} from '@/services/notifications.service';

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
  mode: 'light' as const,
};

export default function RootLayout() {
  const { initialize, isAuthenticated, user } = useAuthStore();
  const {
    subscribeToConversations,
    unsubscribeFromConversations,
    conversations,
  } = useMessagingStore();
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(false);
  const prevUnreadRef = useRef<Record<string, number> | null>(null); // null = not seeded yet
  const rcReadinessLoggedRef = useRef(false);

  useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
  });

  useEffect(() => {
    let mounted = true;
    initialize().finally(() => {
      if (mounted) setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [initialize]);

  useEffect(() => {
    configureNotifications();
  }, []);

  // Global real-time subscription to conversations (keeps unread badges live)
  // The messaging service internally waits for Firebase Auth if not ready yet
  useEffect(() => {
    let removeRCListener: (() => void) | null = null;

    if (isAuthenticated) {
      subscribeToConversations();

      // Register push token for background notifications
      registerForPushNotifications().then((token) => {
        if (token && user && user.expo_push_token !== token) {
          firebaseService.updateProfile(user.id, { expo_push_token: token } as any).catch(() => {});
        }
      }).catch(() => {});

      // Initialize RevenueCat, sync premium status, THEN sync usage store
      if (user) {
        (async () => {
          try {
            await revenueCatService.initialize();
            await revenueCatService.login(user.id);

            if (!rcReadinessLoggedRef.current) {
              const [monthlyReadiness, yearlyReadiness] = await Promise.all([
                revenueCatService.getPurchaseReadiness('monthly'),
                revenueCatService.getPurchaseReadiness('yearly'),
              ]);
              console.info('[RevenueCat] Startup purchase readiness:', {
                monthly: monthlyReadiness,
                yearly: yearlyReadiness,
              });
              rcReadinessLoggedRef.current = true;
            }

            const rcIsPremium = await revenueCatService.isPremium();
            const customerInfo = await revenueCatService.getCustomerInfo();
            const expirationDate = customerInfo
              ? revenueCatService.getExpirationDate(customerInfo)
              : null;

            // Sync RC → Firebase: RC says premium but Firebase says no
            if (rcIsPremium && !user.is_premium) {
              const updates: Record<string, any> = { is_premium: true };
              if (expirationDate) updates.premium_expires_at = expirationDate;
              await firebaseService.updateProfile(user.id, updates);
              useAuthStore.setState((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
              }));
            }
            // Sync RC → Firebase: RC says NOT premium but Firebase says yes
            if (!rcIsPremium && user.is_premium) {
              const updates = { is_premium: false, premium_expires_at: null };
              await firebaseService.updateProfile(user.id, updates);
              useAuthStore.setState((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
              }));
            }

            // Now sync usage — premium status is accurate at this point
            await useUsageStore.getState().syncFromFirebase();

            // Register real-time listener for subscription changes
            removeRCListener = revenueCatService.addPremiumStatusListener(
              async (info) => {
                try {
                  const isPremiumNow = revenueCatService.hasPremiumEntitlement(info);
                  const expDate = revenueCatService.getExpirationDate(info);
                  const currentUser = useAuthStore.getState().user;
                  if (!currentUser) return;

                  if (isPremiumNow && !currentUser.is_premium) {
                    const updates: Record<string, any> = { is_premium: true };
                    if (expDate) updates.premium_expires_at = expDate;
                    await firebaseService.updateProfile(currentUser.id, updates);
                    useAuthStore.setState((state) => ({
                      user: state.user ? { ...state.user, ...updates } : null,
                    }));
                  } else if (!isPremiumNow && currentUser.is_premium) {
                    const updates = { is_premium: false, premium_expires_at: null };
                    await firebaseService.updateProfile(currentUser.id, updates);
                    useAuthStore.setState((state) => ({
                      user: state.user ? { ...state.user, ...updates } : null,
                    }));
                  }

                  // Re-sync usage after premium status change
                  await useUsageStore.getState().syncFromFirebase();
                } catch (err) {
                  console.error('RC listener sync error:', err);
                }
              }
            );
          } catch (error) {
            console.error('RevenueCat init error:', error);
            // Fallback: sync usage even if RC fails
            await useUsageStore.getState().syncFromFirebase();
          }
        })();
      } else {
        // No user object yet — sync usage with whatever state exists
        useUsageStore.getState().syncFromFirebase();
      }
    } else {
      prevUnreadRef.current = null;
    }
    return () => {
      unsubscribeFromConversations();
      if (removeRCListener) removeRCListener();
    };
  }, [isAuthenticated]);

  // Fire local notification when a conversation's unread count increases
  useEffect(() => {
    if (!user || !isAuthenticated || conversations.length === 0) return;

    // Build current snapshot
    const currentSnapshot: Record<string, number> = {};
    for (const conv of conversations) {
      const myDetails = conv.participant_details.find(p => p.user_id === user.id);
      currentSnapshot[conv.id] = myDetails?.unread_count || 0;
    }

    // First load — just seed, don't fire notifications for existing unreads
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = currentSnapshot;
      return;
    }

    // Compare and notify
    for (const conv of conversations) {
      const currentUnread = currentSnapshot[conv.id] || 0;
      const prevUnread = prevUnreadRef.current[conv.id] || 0;

      if (currentUnread > prevUnread) {
        const myDetails = conv.participant_details.find(p => p.user_id === user.id);
        // Don't notify if user is viewing this chat or it's muted
        const isViewingChat = pathname?.includes('/chat/');
        if (isViewingChat || myDetails?.is_muted) continue;

        const senderDetails = conv.participant_details.find(
          p => p.user_id === conv.last_message_sender_id
        );
        const senderName = conv.is_group
          ? conv.group_name || 'Group'
          : senderDetails?.full_name || 'Someone';

        showMessageNotification({
          senderName,
          body: conv.last_message || 'Sent you a message',
          conversationId: conv.id,
        }).catch(() => {});
      }
    }

    prevUnreadRef.current = currentSnapshot;
  }, [conversations, user?.id, isAuthenticated]);

  // Handle notification tap — navigate to the conversation
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'message' && data?.conversationId) {
        router.push(`/chat/${data.conversationId}?conversationId=${data.conversationId}` as any);
      }
    });
    return () => subscription.remove();
  }, [router]);

  // Handle deep link URLs (e.g. from Dynamic Island / Live Activity tap)
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      const recipeMatch = url.match(/recipe\/([^?/]+)/);
      if (recipeMatch?.[1]) {
        const recipeId = decodeURIComponent(recipeMatch[1]);
        const target = `/recipe/${recipeId}` as any;

        if (pathname?.startsWith(`/recipe/${recipeId}`)) {
          router.replace(target);
        } else {
          router.push(target);
        }
        return;
      }

      // URL format: recipeapp://cooking/<recipeId>?laAction=next|prev
      const cookingMatch = url.match(/cooking\/([^?/]+)/);
      if (!cookingMatch?.[1]) return;

      const recipeId = decodeURIComponent(cookingMatch[1]);
      const rawQuery = url.includes('?') ? url.split('?')[1] : '';
      const params = new URLSearchParams(rawQuery);
      const action = params.get('laAction');
      const validAction = action === 'next' || action === 'prev' || action === 'timer' ? action : null;

      const query = validAction
        ? `?laAction=${validAction}&laSource=liveActivity&laNonce=${Date.now()}`
        : '';
      const target = `/cooking/${recipeId}${query}` as any;

      if (pathname?.startsWith(`/cooking/${recipeId}`)) {
        router.replace(target);
      } else {
        router.push(target);
      }
    };

    // Cold start — app was not running
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Warm launch — app was in background
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [pathname, router]);

  // Redirect to welcome page when not authenticated.
  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) return;

    const isPublicRoute =
      pathname === '/auth' ||
      pathname.startsWith('/auth/') ||
      pathname === '/welcome' ||
      pathname === '/onboarding';

    if (!isPublicRoute) {
      router.replace('/welcome');
    }
  }, [authReady, isAuthenticated, pathname, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MenuProvider>
        <BottomSheetModalProvider>
          <ThemeProvider theme={theme}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth/index" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="recipe/[id]"
              options={{
                headerShown: false,
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
              name="edit-recipe"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="add-recipe"
              options={{
                headerShown: false,
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
              name="cookbook-scan"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="cookbook-review"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="recent-scans"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="scan-detail"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="recipe-preferences"
              options={{
                headerShown: false,
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
            <Stack.Screen
              name="chat/[userId]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="find-users"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="profile/[userId]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="share-recipe"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="share-shopping"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="setup-username"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="create-group"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="group-settings/[groupId]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="edit-profile"
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="blocked-users"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="shopping-list-detail"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ai-chef-chat"
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="cookbooks"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="cookbook/[id]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="usage-details"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="help-faq"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="terms-privacy"
              options={{
                headerShown: false,
              }}
            />
            </Stack>
          </ThemeProvider>
        </BottomSheetModalProvider>
      </MenuProvider>
    </GestureHandlerRootView>
  );
}
