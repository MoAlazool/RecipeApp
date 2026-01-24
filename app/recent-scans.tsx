import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseService } from '@/services/firebase.service';
import type { FridgeScan } from '@/utils/types';

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

export default function RecentScansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recentScans, setRecentScans] = useState<FridgeScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    try {
      setLoading(true);
      console.log('[RecentScans] Loading scans...');
      const scans = await firebaseService.getFridgeScans(20);
      console.log('[RecentScans] Loaded', scans?.length || 0, 'scans');
      setRecentScans(scans || []);
    } catch (error) {
      console.error('[RecentScans] Failed to load scans:', error);
      setRecentScans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewScan = (scan: FridgeScan) => {
    router.push({
      pathname: '/scan-detail',
      params: {
        scanId: scan.id,
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C100D" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Recent Activity</Text>
          <Text style={styles.headerSubtitle}>
            {recentScans.length} {recentScans.length === 1 ? 'scan' : 'scans'}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
          <Text style={styles.loadingText}>Loading scans...</Text>
        </View>
      ) : recentScans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="camera-outline" size={64} color="#C8B7B2" />
          </View>
          <Text style={styles.emptyTitle}>No Scans Yet</Text>
          <Text style={styles.emptyText}>
            Take a photo of your fridge to get started
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {recentScans.map((scan) => {
            const scanDate = new Date(scan.created_at);
            const timeAgo = getTimeAgo(scanDate);
            const dateString = scanDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <Pressable
                key={scan.id}
                style={styles.scanCard}
                onPress={() => handleViewScan(scan)}
              >
                <View style={styles.scanIconContainer}>
                  <Ionicons name="camera" size={28} color="#556B2F" />
                </View>
                <View style={styles.scanInfo}>
                  <Text style={styles.scanTitle}>
                    {scan.total_items} {scan.total_items === 1 ? 'item' : 'items'} detected
                  </Text>
                  <Text style={styles.scanDate}>{timeAgo}</Text>
                  <Text style={styles.scanFullDate}>{dateString}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#C8B7B2" />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D3CE',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(200, 183, 178, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scanIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(85, 107, 47, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanInfo: {
    flex: 1,
  },
  scanTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 6,
  },
  scanDate: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginBottom: 3,
  },
  scanFullDate: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#C8B7B2',
  },
});
