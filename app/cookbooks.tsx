import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useCookbookStore } from '@/stores/cookbookStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { EmptyState } from '@/components/ui/EmptyState';
import * as Haptics from 'expo-haptics';
import type { Cookbook } from '@/utils/types';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  muted: '#8A8578',
  terracotta: '#B8845C',
  gold: '#D4AF37',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

const FOOD_EMOJIS = [
  '🍳', '🥗', '🍝', '🍰', '🍜', '🥘', '🍕', '🌮',
  '🍣', '🥐', '🍔', '🥩', '🍲', '🧁', '🥙', '🍱',
  '🫕', '🥑', '🍛', '🥞', '🍤', '🧆', '🥧', '🍩',
];

export default function CookbooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cookbooks, createCookbook, deleteCookbook } = useCookbookStore();
  const { recipes } = useRecipeStore();
  const createSheetRef = useRef<BottomSheetModal>(null);
  const optionsSheetRef = useRef<BottomSheetModal>(null);

  const [newName, setNewName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍳');
  const [selectedCookbook, setSelectedCookbook] = useState<Cookbook | null>(null);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCookbook(name, selectedEmoji);
      setNewName('');
      setSelectedEmoji('🍳');
      createSheetRef.current?.dismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create cookbook');
    }
  }, [newName, selectedEmoji, createCookbook]);

  const handleDelete = useCallback((cookbook: Cookbook) => {
    optionsSheetRef.current?.dismiss();
    setTimeout(() => {
      Alert.alert('Delete Cookbook', `Delete "${cookbook.name}"? Recipes won't be deleted.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCookbook(cookbook.id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete');
            }
          },
        },
      ]);
    }, 200);
  }, [deleteCookbook]);

  const handleOpenOptions = useCallback((cookbook: Cookbook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCookbook(cookbook);
    optionsSheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />,
    [],
  );

  const getThumbsForCookbook = (recipeIds: string[]) => {
    return recipeIds
      .slice(0, 3)
      .map((rid) => recipes.find((r) => r.id === rid))
      .filter(Boolean);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (item._isNew) {
      return (
        <TouchableOpacity
          style={[styles.cookbookCard, styles.newCard, index % 2 === 0 ? { marginRight: 6 } : { marginLeft: 6 }]}
          onPress={() => createSheetRef.current?.present()}
          activeOpacity={0.8}
        >
          <View style={styles.newIconWrap}>
            <Ionicons name="add" size={32} color={C.muted} />
          </View>
          <Text style={styles.newLabel}>New Cookbook</Text>
        </TouchableOpacity>
      );
    }

    const thumbs = getThumbsForCookbook(item.recipe_ids);

    return (
      <TouchableOpacity
        style={[styles.cookbookCard, index % 2 === 0 ? { marginRight: 6 } : { marginLeft: 6 }]}
        onPress={() => router.push(`/cookbook/${item.id}` as any)}
        activeOpacity={0.85}
      >
        {/* Options button */}
        <Pressable
          style={styles.optionsBtn}
          onPress={() => handleOpenOptions(item)}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={C.muted} />
        </Pressable>

        <Text style={styles.cookbookEmoji}>{item.emoji || '🍳'}</Text>
        <Text style={styles.cookbookName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cookbookCount}>
          {item.recipe_ids.length} {item.recipe_ids.length === 1 ? 'recipe' : 'recipes'}
        </Text>
        {thumbs.length > 0 && (
          <View style={styles.thumbRow}>
            {thumbs.map((r: any) => (
              <Image
                key={r.id}
                source={{ uri: r.thumbnail_url }}
                style={styles.thumbImg}
                contentFit="cover"
                transition={200}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const data = [...cookbooks, { _isNew: true, id: '__new__' }];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cookbooks</Text>
        <TouchableOpacity onPress={() => createSheetRef.current?.present()} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={C.terracotta} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="library-outline"
            title="No cookbooks yet"
            subtitle="Organize your recipes into custom collections"
          />
        }
      />

      {/* Create Cookbook Sheet */}
      <BottomSheetModal
        ref={createSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>New Cookbook</Text>

          <BottomSheetTextInput
            style={styles.nameInput}
            placeholder="Cookbook name"
            placeholderTextColor={C.muted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />

          <Text style={styles.emojiLabel}>Choose an icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll} contentContainerStyle={styles.emojiList}>
            {FOOD_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={[styles.emojiBtn, selectedEmoji === emoji && styles.emojiBtnSelected]}
                onPress={() => setSelectedEmoji(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>Create Cookbook</Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 8 }} />
        </BottomSheetView>
      </BottomSheetModal>

      {/* Options Sheet */}
      <BottomSheetModal
        ref={optionsSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedCookbook && (
            <>
              <View style={styles.optionsHeader}>
                <Text style={styles.optionsEmoji}>{selectedCookbook.emoji || '🍳'}</Text>
                <Text style={styles.optionsName}>{selectedCookbook.name}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.optionsRow, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  optionsSheetRef.current?.dismiss();
                  setTimeout(() => router.push(`/cookbook/${selectedCookbook.id}` as any), 200);
                }}
              >
                <Ionicons name="open-outline" size={20} color={C.charcoal} />
                <Text style={styles.optionsRowText}>Open Cookbook</Text>
              </Pressable>

              <View style={styles.optionsDivider} />

              <Pressable
                style={({ pressed }) => [styles.optionsRow, pressed && { opacity: 0.6 }]}
                onPress={() => handleDelete(selectedCookbook)}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.optionsRowText, { color: '#EF4444' }]}>Delete Cookbook</Text>
              </Pressable>
            </>
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
  },
  grid: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  cookbookCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 140,
  },
  optionsBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  newCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.08)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  newIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  newLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
  },
  cookbookEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  cookbookName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: C.charcoal,
    marginBottom: 4,
  },
  cookbookCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },
  thumbRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 4,
  },
  thumbImg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E8E2D8',
  },

  // Create Sheet
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: C.charcoal,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 20,
  },
  emojiLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  emojiScroll: {
    marginBottom: 24,
  },
  emojiList: {
    gap: 8,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiBtnSelected: {
    borderColor: C.terracotta,
    backgroundColor: 'rgba(184, 132, 92, 0.08)',
  },
  emojiText: {
    fontSize: 22,
  },
  createBtn: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Options Sheet
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  optionsEmoji: {
    fontSize: 28,
  },
  optionsName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: C.charcoal,
    flex: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  optionsRowText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: C.charcoal,
  },
  optionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginVertical: 4,
  },
});
