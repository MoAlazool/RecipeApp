import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getData } from '@/utils/imageCache';
import { useShoppingStore } from '@/stores/shoppingStore';
import type { SharedShoppingListData, SharedShoppingItem, IngredientCategory } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  background: '#FAFAF8',
  cardBg: '#F5F3EE',
};

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  produce: '#4ADE80',
  meat: '#F87171',
  dairy: '#60A5FA',
  pantry: '#FB923C',
  spices: '#F59E0B',
  frozen: '#818CF8',
  beverage: '#A78BFA',
  condiment: '#F472B6',
  other: '#9CA3AF',
};

const CATEGORY_ICONS: Record<IngredientCategory, string> = {
  produce: 'leaf',
  meat: 'flame',
  dairy: 'water',
  pantry: 'cube',
  spices: 'flower',
  frozen: 'snow',
  beverage: 'cafe',
  condiment: 'color-fill',
  other: 'ellipsis-horizontal',
};

// ============================================================
// ITEM ROW
// ============================================================

function ItemRow({ item }: { item: SharedShoppingItem }) {
  const color = CATEGORY_COLORS[item.category] || C.muted;
  const amountStr = [
    item.amount != null ? String(item.amount) : '',
    item.unit || '',
  ].filter(Boolean).join(' ');

  return (
    <View style={[styles.itemRow, item.is_checked && styles.itemRowChecked]}>
      <View style={[styles.itemDot, { backgroundColor: color }]} />
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, item.is_checked && styles.itemNameChecked]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.recipe_name ? (
          <Text style={styles.itemRecipe} numberOfLines={1}>
            {item.recipe_name}
          </Text>
        ) : null}
      </View>
      {amountStr ? (
        <Text style={styles.itemAmount}>{amountStr}</Text>
      ) : null}
      {item.is_checked && (
        <Ionicons name="checkmark-circle" size={16} color="#6B8E23" />
      )}
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function ShoppingListDetailScreen() {
  const { cacheKey } = useLocalSearchParams<{ cacheKey: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addItem = useShoppingStore((s) => s.addItem);

  const [listData, setListData] = useState<SharedShoppingListData | null>(null);
  const [listSaved, setListSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load list data from cache
  useEffect(() => {
    if (!cacheKey) return;
    const data = getData<SharedShoppingListData>(cacheKey);
    if (data) setListData(data);
  }, [cacheKey]);

  const uncheckedItems = listData?.items.filter((i) => !i.is_checked) || [];

  const handleAddToMyList = useCallback(async () => {
    if (!listData || listSaved || isSaving) return;
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      for (const item of uncheckedItems) {
        await addItem({
          name: item.name,
          amount: item.amount,
          unit: item.unit as any,
          category: item.category,
          recipe_name: item.recipe_name,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setListSaved(true);
    } catch {
      Alert.alert('Error', 'Failed to add items to your list.');
    } finally {
      setIsSaving(false);
    }
  }, [listData, listSaved, isSaving, uncheckedItems, addItem]);

  if (!listData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.terracotta} style={{ marginTop: 60 }} />
      </View>
    );
  }

  // Group items by category
  const grouped = new Map<IngredientCategory, SharedShoppingItem[]>();
  for (const item of listData.items) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }

  const progress = listData.totalItems > 0
    ? Math.round((listData.checkedItems / listData.totalItems) * 100)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.charcoal} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Grocery List</Text>
          <Text style={styles.headerSub}>{listData.listName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Ionicons name="cart-outline" size={13} color={C.terracotta} />
          <Text style={styles.statText}>{listData.totalItems} items</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="checkmark-done-outline" size={13} color={C.terracotta} />
          <Text style={styles.statText}>{listData.checkedItems} done</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="pie-chart-outline" size={13} color={C.terracotta} />
          <Text style={styles.statText}>{progress}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Items grouped by category */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {listData.items.length === 0 && (
          <Text style={styles.emptyText}>No items in this list</Text>
        )}
        {Array.from(grouped).map(([category, items]) => {
          const color = CATEGORY_COLORS[category] || C.muted;
          const icon = CATEGORY_ICONS[category] || 'ellipsis-horizontal';

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon as any} size={14} color={color} />
                </View>
                <Text style={styles.categoryLabel}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <Text style={styles.categoryCount}>{items.length}</Text>
              </View>
              {items.map((item, i) => (
                <ItemRow key={`${category}-${i}`} item={item} />
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom action */}
      {uncheckedItems.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.saveAllBtn,
              listSaved && styles.saveAllBtnSaved,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleAddToMyList}
            disabled={listSaved || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={C.ivory} />
            ) : (
              <Ionicons
                name={listSaved ? 'checkmark-circle' : 'cart-outline'}
                size={18}
                color={listSaved ? '#6B8E23' : C.ivory}
              />
            )}
            <Text style={[styles.saveAllText, listSaved && styles.saveAllTextSaved]}>
              {listSaved
                ? 'Added to My List'
                : `Add ${uncheckedItems.length} Item${uncheckedItems.length !== 1 ? 's' : ''} to My List`}
            </Text>
          </Pressable>
        </View>
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
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
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
  headerSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.charcoal,
  },
  progressWrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.terracotta,
  },
  content: {
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 40,
  },

  // Category section
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.charcoal,
    flex: 1,
  },
  categoryCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ivory,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 10,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemRowChecked: {
    opacity: 0.5,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: C.muted,
  },
  itemRecipe: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: C.muted,
  },
  itemAmount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.terracotta,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 21, 16, 0.05)',
  },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  saveAllBtnSaved: {
    backgroundColor: 'rgba(107, 142, 35, 0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: C.ivory,
  },
  saveAllTextSaved: {
    color: '#6B8E23',
  },
});
