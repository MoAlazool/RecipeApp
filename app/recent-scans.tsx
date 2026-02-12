import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { firebaseService } from '@/services/firebase.service';
import { useAuthStore } from '@/stores/authStore';
import type { FridgeScan } from '@/utils/types';

// ============================================================
// DESIGN TOKENS — Matching Recipe Detail Screen
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
  olive: '#6B8E23',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

// ============================================================
// HELPERS
// ============================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }

  return 'Just now';
}

// ============================================================
// SCAN CARD COMPONENT
// ============================================================

interface ScanCardProps {
  scan: FridgeScan;
  index: number;
  onPress: () => void;
}

function ScanCard({ scan, index, onPress }: ScanCardProps) {
  const scanDate = new Date(scan.created_at);
  const timeAgo = getTimeAgo(scanDate);
  const dateString = scanDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeString = scanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.scanCard,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <View style={styles.scanIconWrap}>
          <View style={styles.scanIcon}>
            <Ionicons name="scan" size={22} color={C.olive} />
          </View>
        </View>

        <View style={styles.scanInfo}>
          <Text style={styles.scanTitle}>
            {scan.total_items} {scan.total_items === 1 ? 'Item' : 'Items'} Detected
          </Text>
          <View style={styles.scanMeta}>
            <View style={styles.scanMetaItem}>
              <Ionicons name="time-outline" size={12} color={C.muted} />
              <Text style={styles.scanMetaText}>{timeAgo}</Text>
            </View>
            <View style={styles.scanMetaDot} />
            <Text style={styles.scanMetaText}>{dateString}</Text>
          </View>
          <Text style={styles.scanTime}>{timeString}</Text>
        </View>

        <View style={styles.scanArrow}>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function RecentScansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPremium = useAuthStore((s) => s.user?.is_premium);
  const [recentScans, setRecentScans] = useState<FridgeScan[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  useFocusEffect(
    useCallback(() => {
      if (!isPremium) {
        setLoading(false);
        return;
      }
      loadScans();
    }, [isPremium])
  );

  const loadScans = async () => {
    try {
      setLoading(true);
      const scans = await firebaseService.getFridgeScans(20);
      setRecentScans(scans || []);
    } catch (error) {
      console.error('[RecentScans] Failed to load scans:', error);
      setRecentScans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewScan = useCallback((scan: FridgeScan) => {
    router.push({
      pathname: '/scan-detail',
      params: { scanId: scan.id },
    });
  }, [router]);

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
          <Animated.View style={[styles.stickyHeaderBg, headerAnimStyle]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          </Animated.View>
          <View style={styles.stickyHeaderInner}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={C.charcoal} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Recent Activity</Text>
              <Text style={styles.headerSubtitle}>Pro Feature</Text>
            </View>
            <View style={styles.backBtn} />
          </View>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="diamond-outline" size={56} color={C.gold} />
          </View>
          <Text style={styles.emptyTitle}>Available for Pro</Text>
          <Text style={styles.emptyText}>
            Recent Activity is available for Pro subscribers only
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={() => router.push('/paywall')}
          >
            <Ionicons name="diamond" size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Upgrade to Pro</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.stickyHeaderBg, headerAnimStyle]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        </Animated.View>
        <View style={styles.stickyHeaderInner}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.charcoal} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Recent Activity</Text>
            <Text style={styles.headerSubtitle}>
              {recentScans.length} {recentScans.length === 1 ? 'scan' : 'scans'}
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="scan" size={40} color={C.gold} />
          </View>
          <Text style={styles.loadingText}>Loading scans...</Text>
        </View>
      ) : recentScans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="camera-outline" size={56} color={C.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Scans Yet</Text>
          <Text style={styles.emptyText}>
            Take a photo of your fridge to discover what you can cook
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/fridge-scan'), 400);
            }}
          >
            <Ionicons name="camera" size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Scan Fridge</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {recentScans.map((scan, index) => (
            <ScanCard
              key={scan.id}
              scan={scan}
              index={index}
              onPress={() => handleViewScan(scan)}
            />
          ))}
          <View style={{ height: insets.bottom + 20 }} />
        </Animated.ScrollView>
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },

  // Sticky Header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderBg: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    overflow: 'hidden',
  },
  stickyHeaderInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.muted,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: C.charcoal,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 16,
    ...SHADOW_SOFT,
    shadowColor: C.terracotta,
    shadowOpacity: 0.25,
  },
  emptyBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Scan Card
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  scanIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 142, 35, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 142, 35, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanInfo: {
    flex: 1,
    gap: 4,
  },
  scanTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.charcoal,
  },
  scanMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanMetaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },
  scanMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.muted,
    opacity: 0.5,
  },
  scanTime: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: C.muted,
    opacity: 0.7,
  },
  scanArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
