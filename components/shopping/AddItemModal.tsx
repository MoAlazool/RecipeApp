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
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, COMMON_INGREDIENTS, CATEGORY_ICONS } from '@/stores/shoppingStore';
import type { IngredientCategory, IngredientUnit } from '@/utils/types';

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: { key: IngredientCategory; label: string }[] = [
  { key: 'produce', label: 'Produce' },
  { key: 'meat', label: 'Meat' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'spices', label: 'Spices' },
  { key: 'frozen', label: 'Frozen' },
  { key: 'beverage', label: 'Drinks' },
  { key: 'condiment', label: 'Condiments' },
  { key: 'other', label: 'Other' },
];

const UNIT_OPTIONS: { label: string; value?: IngredientUnit }[] = [
  { label: 'None' },
  { label: 'pcs', value: 'piece' },
  { label: 'kg', value: 'kg' },
  { label: 'g', value: 'g' },
  { label: 'lb', value: 'lb' },
  { label: 'oz', value: 'oz' },
  { label: 'L', value: 'l' },
  { label: 'ml', value: 'ml' },
  { label: 'cup', value: 'cup' },
  { label: 'tbsp', value: 'tbsp' },
  { label: 'tsp', value: 'tsp' },
];

export function AddItemModal({ visible, onClose }: AddItemModalProps) {
  const { addItem } = useShoppingStore();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<IngredientUnit | undefined>(undefined);
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [isUrgent, setIsUrgent] = useState(false);
  const [notes, setNotes] = useState('');
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
      category,
      is_urgent: isUrgent,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setName('');
    setAmount('');
    setUnit(undefined);
    setCategory('other');
    setIsUrgent(false);
    setNotes('');
    setShowSuggestions(true);

    onClose();
  };

  const handleQuickAdd = (ingredient: { name: string; category: IngredientCategory }) => {
    addItem({
      name: ingredient.name,
      category: ingredient.category,
    });
  };

  const filteredSuggestions = COMMON_INGREDIENTS.filter(
    (ing) => name && ing.name.toLowerCase().includes(name.toLowerCase())
  ).slice(0, 5);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Item</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9C5749" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Item Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Item Name</Text>
              <View style={styles.nameInputContainer}>
                <TextInput
                  ref={inputRef}
                  style={styles.nameInput}
                  placeholder="What do you need?"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setShowSuggestions(true);
                  }}
                  placeholderTextColor="#C8B7B2"
                />
                {isUrgent && (
                  <View style={styles.urgentBadge}>
                    <Ionicons name="alert-circle" size={16} color="#F2330D" />
                  </View>
                )}
              </View>

              {/* Autocomplete Suggestions */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {filteredSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion.name}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setName(suggestion.name);
                        setCategory(suggestion.category);
                        setShowSuggestions(false);
                      }}
                    >
                      <Ionicons
                        name={CATEGORY_ICONS[suggestion.category] as any}
                        size={16}
                        color="#9C5749"
                      />
                      <Text style={styles.suggestionText}>{suggestion.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Amount & Unit Row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#C8B7B2"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Unit</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.unitScroll}
                >
                  {UNIT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      style={[styles.unitChip, unit === option.value && styles.unitChipSelected]}
                      onPress={() => setUnit(option.value)}
                    >
                      <Text
                        style={[styles.unitText, unit === option.value && styles.unitTextSelected]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryChip,
                      category === cat.key && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[cat.key] as any}
                      size={18}
                      color={category === cat.key ? '#FFFFFF' : '#9C5749'}
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        category === cat.key && styles.categoryTextSelected,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Options Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionButton, isUrgent && styles.optionButtonActive]}
                onPress={() => setIsUrgent(!isUrgent)}
              >
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={isUrgent ? '#F2330D' : '#9C5749'}
                />
                <Text style={[styles.optionText, isUrgent && styles.optionTextActive]}>
                  Urgent
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Brand preference, specific type, etc."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                placeholderTextColor="#C8B7B2"
              />
            </View>

            {/* Quick Add Section */}
            <View style={styles.quickAddSection}>
              <Text style={styles.quickAddTitle}>Quick Add</Text>
              <View style={styles.quickAddGrid}>
                {COMMON_INGREDIENTS.slice(0, 8).map((ing) => (
                  <TouchableOpacity
                    key={ing.name}
                    style={styles.quickAddChip}
                    onPress={() => handleQuickAdd(ing)}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[ing.category] as any}
                      size={14}
                      color="#9C5749"
                    />
                    <Text style={styles.quickAddText}>{ing.name}</Text>
                    <Ionicons name="add" size={14} color="#F2330D" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Add Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addButton, !name.trim() && styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add to List</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(28, 16, 13, 0.5)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F1EE',
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    marginBottom: 8,
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F1EE',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  nameInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  urgentBadge: {
    marginLeft: 8,
  },
  suggestions: {
    marginTop: 8,
    backgroundColor: '#F7F1EE',
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D3CE',
  },
  suggestionText: {
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  row: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: '#F7F1EE',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  unitScroll: {
    maxHeight: 44,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F7F1EE',
    marginRight: 8,
  },
  unitChipSelected: {
    backgroundColor: '#F2330D',
  },
  unitText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  unitTextSelected: {
    color: '#FFFFFF',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F7F1EE',
  },
  categoryChipSelected: {
    backgroundColor: '#F2330D',
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F7F1EE',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  optionTextActive: {
    color: '#F2330D',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  quickAddSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F7F1EE',
  },
  quickAddTitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F1EE',
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  quickAddText: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F7F1EE',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 14,
    height: 56,
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(242, 51, 13, 0.4)',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
