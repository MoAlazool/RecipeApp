import React, { forwardRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCookbookStore } from '@/stores/cookbookStore';
import * as Haptics from 'expo-haptics';

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
];

interface AddToCookbookSheetProps {
  recipeId: string;
}

const AddToCookbookSheet = forwardRef<BottomSheetModal, AddToCookbookSheetProps>(
  ({ recipeId }, ref) => {
    const insets = useSafeAreaInsets();
    const { cookbooks, addRecipeToCookbook, removeRecipeFromCookbook, createCookbook } = useCookbookStore();
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState('🍳');

    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />,
      [],
    );

    const handleToggle = useCallback(async (cookbookId: string, isIn: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        if (isIn) {
          await removeRecipeFromCookbook(cookbookId, recipeId);
        } else {
          await addRecipeToCookbook(cookbookId, recipeId);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to update cookbook');
      }
    }, [recipeId, addRecipeToCookbook, removeRecipeFromCookbook]);

    const handleCreate = useCallback(async () => {
      const name = newName.trim();
      if (!name) return;
      try {
        const cookbook = await createCookbook(name, selectedEmoji);
        await addRecipeToCookbook(cookbook.id, recipeId);
        setShowCreate(false);
        setNewName('');
        setSelectedEmoji('🍳');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to create cookbook');
      }
    }, [newName, selectedEmoji, createCookbook, addRecipeToCookbook, recipeId]);

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Add to Cookbook</Text>

          {cookbooks.map((cookbook) => {
            const isIn = cookbook.recipe_ids.includes(recipeId);
            return (
              <TouchableOpacity
                key={cookbook.id}
                style={styles.row}
                onPress={() => handleToggle(cookbook.id, isIn)}
                activeOpacity={0.7}
              >
                <Text style={styles.rowEmoji}>{cookbook.emoji || '🍳'}</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{cookbook.name}</Text>
                  <Text style={styles.rowCount}>{cookbook.recipe_ids.length} recipes</Text>
                </View>
                <Ionicons
                  name={isIn ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isIn ? C.gold : C.muted}
                />
              </TouchableOpacity>
            );
          })}

          {!showCreate ? (
            <TouchableOpacity
              style={styles.createRow}
              onPress={() => setShowCreate(true)}
              activeOpacity={0.7}
            >
              <View style={styles.createIcon}>
                <Ionicons name="add" size={20} color={C.terracotta} />
              </View>
              <Text style={styles.createLabel}>Create New Cookbook</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.createForm}>
              <BottomSheetTextInput
                style={styles.createInput}
                placeholder="Cookbook name"
                placeholderTextColor={C.muted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
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
              <View style={styles.createActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); setNewName(''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !newName.trim() && { opacity: 0.4 }]}
                  onPress={handleCreate}
                  disabled={!newName.trim()}
                >
                  <Text style={styles.saveBtnText}>Create & Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: insets.bottom + 8 }} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

AddToCookbookSheet.displayName = 'AddToCookbookSheet';
export default AddToCookbookSheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowEmoji: {
    fontSize: 28,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  rowCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(184, 132, 92, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.terracotta,
  },
  createForm: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
    paddingTop: 14,
  },
  createInput: {
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.charcoal,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 12,
  },
  emojiScroll: {
    marginBottom: 14,
  },
  emojiList: {
    gap: 6,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
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
    fontSize: 18,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.muted,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.charcoal,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
