import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useCookbookStore } from '@/stores/cookbookStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { EmptyState } from '@/components/ui/EmptyState';
import * as Haptics from 'expo-haptics';
import type { Recipe } from '@/utils/types';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  muted: '#8A8578',
  terracotta: '#B8845C',
  gold: '#D4AF37',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cookbooks, addRecipeToCookbook, removeRecipeFromCookbook, deleteCookbook } = useCookbookStore();
  const { recipes } = useRecipeStore();
  const addSheetRef = useRef<BottomSheetModal>(null);
  const moreSheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState('');

  const cookbook = cookbooks.find((c) => c.id === id);

  const cookbookRecipes = useMemo(() => {
    if (!cookbook) return [];
    return cookbook.recipe_ids
      .map((rid) => recipes.find((r) => r.id === rid))
      .filter(Boolean) as Recipe[];
  }, [cookbook?.recipe_ids, recipes]);

  // Split recipes into "in cookbook" and "not in cookbook" for the picker
  const { inCookbook, notInCookbook } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : recipes;
    const inIds = new Set(cookbook?.recipe_ids || []);
    return {
      inCookbook: filtered.filter((r) => inIds.has(r.id)),
      notInCookbook: filtered.filter((r) => !inIds.has(r.id)),
    };
  }, [recipes, search, cookbook?.recipe_ids]);

  const pickerData = useMemo(() => {
    const sections: any[] = [];
    if (inCookbook.length > 0) {
      sections.push({ _type: 'header', _key: 'h_in', label: `IN THIS COOKBOOK · ${inCookbook.length}` });
      sections.push(...inCookbook.map((r) => ({ ...r, _type: 'recipe', _isIn: true })));
    }
    if (notInCookbook.length > 0) {
      sections.push({ _type: 'header', _key: 'h_all', label: 'ALL RECIPES' });
      sections.push(...notInCookbook.map((r) => ({ ...r, _type: 'recipe', _isIn: false })));
    }
    return sections;
  }, [inCookbook, notInCookbook]);

  const handleToggleRecipe = useCallback(async (recipeId: string, isIn: boolean) => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (isIn) {
        await removeRecipeFromCookbook(id, recipeId);
      } else {
        await addRecipeToCookbook(id, recipeId);
      }
    } catch {}
  }, [id, addRecipeToCookbook, removeRecipeFromCookbook]);

  const handleDeleteCookbook = useCallback(() => {
    if (!cookbook) return;
    moreSheetRef.current?.dismiss();
    setTimeout(() => {
      Alert.alert('Delete Cookbook', `Delete "${cookbook.name}"? Recipes won't be deleted.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCookbook(cookbook.id);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete');
            }
          },
        },
      ]);
    }, 200);
  }, [cookbook, deleteCookbook, router]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />,
    [],
  );

  const renderPickerItem = useCallback(({ item }: { item: any }) => {
    if (item._type === 'header') {
      return (
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>{item.label}</Text>
        </View>
      );
    }

    const isIn = item._isIn;
    return (
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
        onPress={() => handleToggleRecipe(item.id, isIn)}
      >
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.pickerThumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.pickerInfo}>
          <Text
            style={[styles.pickerTitle, isIn && { color: C.gold }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <Text style={styles.pickerMeta} numberOfLines={1} ellipsizeMode="tail">
            {item.total_time_minutes || 15} min{item.cuisine_type ? ` · ${item.cuisine_type}` : ''}
          </Text>
        </View>
        <View style={[styles.toggleBtn, isIn && styles.toggleBtnActive]}>
          <Ionicons
            name={isIn ? 'checkmark' : 'add'}
            size={18}
            color={isIn ? '#FFF' : C.terracotta}
          />
        </View>
      </Pressable>
    );
  }, [handleToggleRecipe]);

  if (!cookbook) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={C.charcoal} />
          </TouchableOpacity>
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Cookbook not found"
          subtitle="This cookbook may have been deleted"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={C.charcoal} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{cookbook.emoji || '🍳'}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{cookbook.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => addSheetRef.current?.present()} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={24} color={C.terracotta} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => moreSheetRef.current?.present()} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={C.charcoal} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={cookbookRecipes}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push(`/recipe/${item.id}`)}
            onCook={() => router.push(`/cooking/${item.id}`)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title="No recipes yet"
            subtitle="Tap + to browse and add your recipes"
          />
        }
      />

      {/* Add Recipes Sheet */}
      <BottomSheetModal
        ref={addSheetRef}
        snapPoints={['80%']}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetFlatList
          data={pickerData}
          renderItem={renderPickerItem}
          keyExtractor={(item: any) => item._key || item.id}
          ListHeaderComponent={(
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>Add Recipes</Text>
                <TouchableOpacity onPress={() => addSheetRef.current?.dismiss()}>
                  <Text style={styles.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.searchWrapper}>
                <Ionicons name="search" size={16} color={C.muted} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search recipes..."
                  placeholderTextColor={C.muted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={C.muted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.pickerList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>No recipes found</Text>
            </View>
          }
        />
      </BottomSheetModal>

      {/* More Options Sheet */}
      <BottomSheetModal
        ref={moreSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetView style={styles.moreContent}>
          <Pressable
            style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.6 }]}
            onPress={handleDeleteCookbook}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
            <Text style={[styles.moreRowText, { color: '#EF4444' }]}>Delete Cookbook</Text>
          </Pressable>

          <View style={styles.moreDivider} />

          <Pressable
            style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.6 }]}
            onPress={() => moreSheetRef.current?.dismiss()}
          >
            <Text style={[styles.moreRowText, { color: C.muted, textAlign: 'center', flex: 1 }]}>Cancel</Text>
          </Pressable>

          <View style={{ height: insets.bottom + 8 }} />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerSide: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerEmoji: {
    fontSize: 22,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: C.charcoal,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: 72,
    justifyContent: 'flex-end',
  },
  iconBtn: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  // Sheet header
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 4,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
  },
  sheetDone: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: C.terracotta,
  },
  searchWrapper: {
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },

  // Section labels
  sectionLabel: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
  },

  // Picker list
  pickerList: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 48,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  pickerThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#E8E2D8',
  },
  pickerInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 4,
  },
  pickerTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: C.charcoal,
  },
  pickerMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: C.muted,
    marginTop: 4,
  },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 132, 92, 0.3)',
    backgroundColor: 'rgba(184, 132, 92, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  toggleBtnActive: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  pickerEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },

  // More sheet
  moreContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  moreRowText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 17,
    color: C.charcoal,
  },
  moreDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginVertical: 4,
  },
});
