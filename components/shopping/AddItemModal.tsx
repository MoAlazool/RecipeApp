import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShoppingStore, COMMON_INGREDIENTS } from '@/stores/shoppingStore';
import type { IngredientUnit } from '@/utils/types';
import { getIngredientImage } from '@/utils/ingredientImages';
import { getIngredientEmoji, CATEGORY_BG_COLORS } from '@/utils/ingredientEmojis';

// ============================================================
// DESIGN TOKENS — Matching Shopping List
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  cardBg: '#F5F3EE',
  background: '#FAFAF8',
};

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
}

const UNITS: { label: string; value?: IngredientUnit }[] = [
  { label: '—' },
  { label: 'pcs', value: 'piece' },
  { label: 'kg', value: 'kg' },
  { label: 'g', value: 'g' },
  { label: 'cup', value: 'cup' },
  { label: 'tbsp', value: 'tbsp' },
  { label: 'tsp', value: 'tsp' },
  { label: 'ml', value: 'ml' },
];

// Get visual for ingredient
const getVisual = (name: string, category?: string) => {
  const image = getIngredientImage(name);
  const emoji = getIngredientEmoji(name);
  const bgColor = category ? (CATEGORY_BG_COLORS[category] || C.cardBg) : C.cardBg;
  return { image, emoji, bgColor };
};

export function AddItemModal({ visible, onClose }: AddItemModalProps) {
  const insets = useSafeAreaInsets();
  const { addItem } = useShoppingStore();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<IngredientUnit | undefined>(undefined);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const handleAdd = () => {
    if (!name.trim()) return;
    addItem({
      name: name.trim(),
      amount: amount ? parseFloat(amount) : undefined,
      unit,
      category: 'other',
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setUnit(undefined);
    setShowSuggestions(true);
  };

  const filteredSuggestions = COMMON_INGREDIENTS.filter(
    (ing) => name && ing.name.toLowerCase().includes(name.toLowerCase())
  ).slice(0, 4);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.container,
            { paddingBottom: insets.bottom + 20 },
            { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Item</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.mainInput}
                placeholder="What do you need?"
                placeholderTextColor={C.muted}
                value={name}
                onChangeText={(text) => { setName(text); setShowSuggestions(true); }}
              />
            </View>

            {/* Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {filteredSuggestions.map((s, index) => {
                  const { image, emoji, bgColor } = getVisual(s.name, s.category);
                  return (
                    <Pressable
                      key={s.name}
                      style={[
                        styles.suggestionItem,
                        index === filteredSuggestions.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => { setName(s.name); setShowSuggestions(false); }}
                    >
                      <View style={[styles.suggestionThumb, !image && { backgroundColor: bgColor }]}>
                        {image ? (
                          <ExpoImage source={image} style={styles.suggestionImage} contentFit="cover" />
                        ) : (
                          <Text style={styles.suggestionEmoji}>{emoji}</Text>
                        )}
                      </View>
                      <Text style={styles.suggestionText}>{s.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={C.muted} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Quantity Row */}
            <View style={styles.quantitySection}>
              <Text style={styles.sectionLabel}>Quantity (optional)</Text>
              <View style={styles.quantityRow}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="1"
                  placeholderTextColor={C.muted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.unitScroll}
                  contentContainerStyle={styles.unitScrollContent}
                >
                  {UNITS.map((u) => (
                    <Pressable
                      key={u.label}
                      style={[styles.unitChip, unit === u.value && styles.unitChipActive]}
                      onPress={() => setUnit(u.value)}
                    >
                      <Text style={[styles.unitText, unit === u.value && styles.unitTextActive]}>
                        {u.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                !name.trim() && styles.addBtnDisabled,
                pressed && name.trim() && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text style={styles.addBtnText}>Add to List</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 21, 16, 0.4)',
  },
  container: {
    backgroundColor: C.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 21, 16, 0.12)',
    alignSelf: 'center',
    marginTop: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    paddingHorizontal: 24,
  },

  // Main Input
  inputContainer: {
    marginBottom: 12,
  },
  mainInput: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    backgroundColor: C.cardBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Suggestions
  suggestions: {
    marginBottom: 16,
    backgroundColor: C.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  suggestionThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  suggestionImage: {
    width: '100%',
    height: '100%',
  },
  suggestionEmoji: {
    fontSize: 18,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },

  // Quantity
  quantitySection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    width: 64,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    backgroundColor: C.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  unitScroll: {
    flex: 1,
  },
  unitScrollContent: {
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.cardBg,
  },
  unitChipActive: {
    backgroundColor: C.charcoal,
  },
  unitText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  unitTextActive: {
    color: C.ivory,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  addBtn: {
    backgroundColor: C.terracotta,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: 'rgba(198, 110, 78, 0.35)',
  },
  addBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
});
