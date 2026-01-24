import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseService } from '@/services/firebase.service';
import type { FridgeScan } from '@/utils/types';
import {
  getIngredientEmoji,
  getIngredientColors,
} from '@/utils/ingredientEmojis';

export default function ScanDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId: string }>();
  const [scan, setScan] = useState<FridgeScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScan();
  }, []);

  const loadScan = async () => {
    try {
      setLoading(true);
      console.log('[ScanDetail] Loading scan:', params.scanId);
      const scanData = await firebaseService.getFridgeScan(params.scanId);
      console.log('[ScanDetail] Loaded scan with', scanData?.total_items || 0, 'items');
      setScan(scanData);
    } catch (error) {
      console.error('[ScanDetail] Failed to load scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFindRecipes = () => {
    if (!scan) return;

    const selectedItems = scan.ingredients.map((ing) => ({
      name: ing.name,
      emoji: getIngredientEmoji(ing.name),
    }));

    router.push({
      pathname: '/recipe-results',
      params: {
        ingredients: JSON.stringify(selectedItems),
        sourceType: 'fridge_scan',
      },
    });
  };

  const handleChatWithAI = () => {
    router.push('/(tabs)/ai-chef');
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      </View>
    );
  }

  if (!scan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#C8B7B2" />
          <Text style={styles.errorTitle}>Scan Not Found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const scanDate = new Date(scan.created_at);
  const dateString = scanDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C100D" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Detected Items</Text>
          <Text style={styles.headerSubtitle}>{dateString}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Items Count Badge */}
      <View style={styles.countBadge}>
        <Ionicons name="cube-outline" size={20} color="#F2330D" />
        <Text style={styles.countText}>
          {scan.total_items} {scan.total_items === 1 ? 'Item' : 'Items'} Found
        </Text>
      </View>

      {/* Items List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {scan.ingredients.map((ingredient, index) => {
          const emoji = getIngredientEmoji(ingredient.name);
          const colors = getIngredientColors(ingredient.category || 'other');

          return (
            <View key={index} style={styles.itemCard}>
              <View style={[styles.itemEmoji, { backgroundColor: colors.bgColor }]}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{ingredient.name}</Text>
                {ingredient.quantity_estimate && (
                  <View style={styles.quantityRow}>
                    <Ionicons name="cube-outline" size={14} color="#9C5749" />
                    <Text style={styles.itemQuantity}>
                      {ingredient.quantity_estimate}
                    </Text>
                  </View>
                )}
              </View>
              {ingredient.confidence_percent && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {ingredient.confidence_percent}%
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Pressable
          style={styles.primaryButton}
          onPress={handleFindRecipes}
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Find Recipes</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={handleChatWithAI}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#F2330D" />
          <Text style={styles.secondaryButtonText}>Chat with AI Chef</Text>
        </Pressable>
      </View>
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
  headerButton: {
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
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
  },
  countText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 160,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemEmoji: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemQuantity: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(85, 107, 47, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: 'NotoSans_700Bold',
    color: '#556B2F',
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E8D3CE',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F2330D',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F2330D',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  backButton: {
    backgroundColor: '#F2330D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
