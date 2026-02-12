import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRecipeStore } from '@/stores/recipeStore';
import type { Recipe, PlannerMealSlot } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  cardBg: '#F5F3EE',
  background: '#FAFAF8',
};

const SNAP_POINTS = ['60%', '90%'];

const SLOT_LABELS: Record<PlannerMealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// ============================================================
// RECIPE ROW
// ============================================================

interface RecipeRowProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
}

const RecipeRow = React.memo(({ recipe, onSelect }: RecipeRowProps) => {
  const time = recipe.total_time_minutes;
  const timeLabel = time < 60 ? `${time} min` : `${Math.round(time / 60 * 2) / 2} hr`;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => onSelect(recipe)}
    >
      <ExpoImage
        source={recipe.thumbnail_url ? { uri: recipe.thumbnail_url } : undefined}
        style={styles.thumb}
        contentFit="cover"
        placeholder={undefined}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{recipe.title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {timeLabel}{recipe.cuisine_type ? ` · ${recipe.cuisine_type}` : ''}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={22} color={C.gold} />
    </Pressable>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================

interface RecipePickerSheetProps {
  slot: PlannerMealSlot | null;
  onSelect: (recipe: Recipe) => void;
}

const RecipePickerSheet = forwardRef<BottomSheetModal, RecipePickerSheetProps>(
  ({ slot, onSelect }, ref) => {
    const recipes = useRecipeStore((s) => s.recipes);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
      if (!search.trim()) return recipes;
      const q = search.toLowerCase();
      return recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.cuisine_type?.toLowerCase().includes(q)
      );
    }, [recipes, search]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const handleSelect = useCallback(
      (recipe: Recipe) => {
        onSelect(recipe);
        (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
        setSearch('');
      },
      [onSelect, ref]
    );

    const renderItem = useCallback(
      ({ item }: { item: Recipe }) => (
        <RecipeRow recipe={item} onSelect={handleSelect} />
      ),
      [handleSelect]
    );

    const keyExtractor = useCallback((item: Recipe) => item.id, []);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={SNAP_POINTS}
        index={0}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBg}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="restaurant-outline" size={18} color={C.gold} />
          <Text style={styles.headerTitle}>
            Add {slot ? SLOT_LABELS[slot] : 'Meal'}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.muted} style={styles.searchIcon} />
          <BottomSheetTextInput
            style={styles.searchInput}
            placeholder="Search your recipes..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>

        {/* List */}
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={32} color={C.hairline} />
              <Text style={styles.emptyText}>
                {search ? 'No recipes found' : 'No saved recipes yet'}
              </Text>
            </View>
          }
        />
      </BottomSheetModal>
    );
  }
);

RecipePickerSheet.displayName = 'RecipePickerSheet';
export default RecipePickerSheet;

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: C.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: C.hairline,
    width: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
    color: C.charcoal,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
    paddingVertical: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: C.cardBg,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    marginBottom: 2,
  },
  rowSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
  },
});
