import { useRef, useState, useCallback } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuthStore } from '@/stores/authStore';
import { useUsageStore } from '@/stores/usageStore';
import { revenueCatService } from '@/services/revenueCat.service';
import { firebaseService } from '@/services/firebase.service';
import { FREE_PLAN_LIMITS } from '@/utils/types';
import type { LimitType } from '@/components/ui/UsageLimitSheet';

interface LimitInfo {
  type: LimitType;
  used: number;
  total: number;
}

export function useUsageGate() {
  const user = useAuthStore((s) => s.user);
  const limitSheetRef = useRef<BottomSheetModal>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo>({
    type: 'scan',
    used: 0,
    total: FREE_PLAN_LIMITS.scans_per_week,
  });

  const checkGate = useCallback(
    async (type: LimitType): Promise<boolean> => {
      // Fast path: auth store already knows user is premium
      if (user?.is_premium) return true;

      const store = useUsageStore.getState();

      // If store hasn't loaded yet, sync first
      if (!store.isLoaded) {
        await store.syncFromFirebase();
      }

      const state = useUsageStore.getState();
      let isBlocked = false;
      let info: LimitInfo | null = null;

      if (type === 'scan' && state.getScansRemaining() <= 0) {
        info = { type: 'scan', used: state.scansUsed, total: FREE_PLAN_LIMITS.scans_per_week };
        isBlocked = true;
      } else if (type === 'ai_chat' && state.getChatsRemaining() <= 0) {
        info = { type: 'ai_chat', used: state.chatsUsed, total: FREE_PLAN_LIMITS.ai_chats_per_week };
        isBlocked = true;
      } else if (type === 'recipe' && state.getRecipesRemaining() <= 0) {
        info = { type: 'recipe', used: state.recipesUsed, total: FREE_PLAN_LIMITS.recipes_per_week };
        isBlocked = true;
      } else if (type === 'week_planner') {
        info = { type: 'week_planner', used: 0, total: 0 };
        isBlocked = true;
      }

      if (!isBlocked) return true;

      // Safety net: before blocking, double-check with RevenueCat
      // This catches free trial users whose premium status hasn't synced yet
      // (e.g., cold start from share extension where _layout RC init hasn't finished)
      try {
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.id) {
          // Ensure RC is fully initialized AND logged in as the current user.
          // Without login, getCustomerInfo() returns anonymous user — no entitlements.
          await revenueCatService.initialize();
          await revenueCatService.login(currentUser.id);
        }
        const rcIsPremium = await revenueCatService.isPremium();
        if (rcIsPremium) {
          // Update auth store so future checks are instant
          useAuthStore.setState((s) => ({
            user: s.user ? { ...s.user, is_premium: true } : null,
          }));
          // Also update Firebase so checkUsageLimits returns correct values
          if (currentUser?.id) {
            firebaseService.updateProfile(currentUser.id, { is_premium: true } as any).catch(() => {});
          }
          return true;
        }
      } catch {
        // RC check failed — fall through to block
      }

      if (info) {
        setLimitInfo(info);
        limitSheetRef.current?.present();
      }
      return false;
    },
    [user?.is_premium]
  );

  return { checkGate, limitSheetRef, limitInfo };
}
