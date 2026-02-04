import React, { useState, useCallback, useRef, useMemo, memo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated as RNAnimated,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useShoppingStore,
  type ShoppingItem,
} from '@/stores/shoppingStore';
import { AddItemModal } from '@/components/shopping/AddItemModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import { getIngredientImage } from '@/utils/ingredientImages';
import { getIngredientEmoji, CATEGORY_BG_COLORS } from '@/utils/ingredientEmojis';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent, VOICE_AVAILABLE } from '@/utils/speechRecognition';
import { aiService } from '@/services/ai.service';

// ============================================================
// DESIGN TOKENS
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

// ============================================================
// CHECKBOX COMPONENT
// ============================================================

interface CheckboxProps {
  isChecked: boolean;
  onToggle: () => void;
}

const Checkbox = memo(function Checkbox({ isChecked, onToggle }: CheckboxProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.85, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 15 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }, [onToggle, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} hitSlop={12}>
      <Animated.View style={[styles.checkbox, isChecked && styles.checkboxChecked, animStyle]}>
        {isChecked && <Ionicons name="checkmark" size={14} color="#FFF" />}
      </Animated.View>
    </Pressable>
  );
});

// ============================================================
// ITEM ROW COMPONENT
// ============================================================

interface ItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}

const ItemRow = memo(function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  const image = useMemo(() => getIngredientImage(item.name), [item.name]);
  const emoji = useMemo(() => getIngredientEmoji(item.name), [item.name]);
  const bgColor = CATEGORY_BG_COLORS[item.category] || C.cardBg;

  return (
    <View style={styles.itemRow}>
      {/* Image with delete button */}
      <View style={styles.itemImageWrap}>
        <View style={[styles.itemImage, !image && { backgroundColor: bgColor }]}>
          {image ? (
            <ExpoImage source={image} style={styles.itemImageInner} contentFit="cover" />
          ) : (
            <Text style={styles.itemEmoji}>{emoji}</Text>
          )}
        </View>
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <Ionicons name="close" size={15} color={C.muted} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.amount != null && (
          <Text style={styles.itemAmount}>
            {item.amount}{item.unit ? ` ${item.unit}` : ''}
          </Text>
        )}
      </View>

      {/* Checkbox */}
      <Checkbox isChecked={item.is_checked} onToggle={onToggle} />
    </View>
  );
});

// ============================================================
// SECTION COMPONENT
// ============================================================

interface SectionProps {
  title: string;
  subtitle?: string;
  items: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClear: () => void;
}

const Section = memo(function Section({ title, subtitle, items, onToggleItem, onDeleteItem, onClear }: SectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            Alert.alert('Clear Section', `Remove all ${items.length} items from "${title}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ]);
          }}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.sectionDivider} />

      {/* Items */}
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onToggle={() => onToggleItem(item.id)}
          onDelete={() => onDeleteItem(item.id)}
        />
      ))}
    </View>
  );
});

// ============================================================
// CHECKED SECTION COMPONENT
// ============================================================

interface CheckedSectionProps {
  items: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

const CheckedSection = memo(function CheckedSection({ items, onToggleItem, onDeleteItem, onClearAll }: CheckedSectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  return (
    <View style={styles.checkedSection}>
      {/* Header */}
      <Pressable style={styles.checkedHeader} onPress={() => setExpanded(!expanded)}>
        <View style={styles.checkedTitleRow}>
          <Ionicons name="checkmark-circle" size={20} color={C.gold} />
          <Text style={styles.checkedTitle}>Checked</Text>
          <Text style={styles.checkedCount}>{items.length}</Text>
        </View>
        <View style={styles.checkedActions}>
          <Pressable
            style={styles.clearCheckedBtn}
            onPress={() => {
              Alert.alert('Clear Checked', `Remove all ${items.length} checked items?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: onClearAll },
              ]);
            }}
          >
            <Text style={styles.clearCheckedText}>Clear</Text>
          </Pressable>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </View>
      </Pressable>

      {/* Items */}
      {expanded && (
        <View style={styles.checkedItems}>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(item.id)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const {
    items,
    toggleItem,
    removeItem,
    addItem,
  } = useShoppingStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [deletedItem, setDeletedItem] = useState<ShoppingItem | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const undoAnim = useRef(new RNAnimated.Value(100)).current;

  // Voice input state (continuous listening like cooking mode)
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const listeningRef = useRef(false);
  const lastProcessedRef = useRef('');
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveBars = useRef(
    Array.from({ length: 5 }, () => new RNAnimated.Value(0.3))
  ).current;

  // Wave animation for listening state
  useEffect(() => {
    if (!isListening) {
      waveBars.forEach(bar => {
        bar.stopAnimation();
        bar.setValue(0.3);
      });
      return;
    }

    // Breathing animation for each bar
    const heights = [0.4, 0.6, 0.8, 0.6, 0.4];
    waveBars.forEach((bar, i) => {
      const breathe = () => {
        if (!listeningRef.current) return;
        RNAnimated.sequence([
          RNAnimated.timing(bar, {
            toValue: heights[i],
            duration: 600 + i * 100,
            useNativeDriver: true,
          }),
          RNAnimated.timing(bar, {
            toValue: 0.25,
            duration: 600 + i * 100,
            useNativeDriver: true,
          }),
        ]).start(() => breathe());
      };
      setTimeout(breathe, i * 80);
    });

    return () => {
      waveBars.forEach(bar => bar.stopAnimation());
    };
  }, [isListening]);

  // Speech recognition event handlers (continuous mode like cooking)
  useSpeechRecognitionEvent('result', (event: any) => {
    if (!listeningRef.current) return;
    const transcript = event?.results?.[0]?.transcript?.trim() || '';
    if (!transcript) return;

    console.log('[Voice] Heard:', transcript);
    setVoiceTranscript(transcript);

    // Debounce processing - wait for user to stop speaking
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    processingTimeoutRef.current = setTimeout(async () => {
      // Don't process the same text twice
      if (transcript === lastProcessedRef.current) return;
      lastProcessedRef.current = transcript;

      setIsProcessingVoice(true);
      setVoiceMessage('Adding...');

      try {
        const result = await aiService.parseGroceryVoice(transcript);

        if (result.understood && result.items.length > 0) {
          result.items.forEach(item => {
            addItem({
              name: item.name,
              amount: item.amount ?? undefined,
              unit: item.unit as any,
              category: item.category as any,
            });
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setVoiceMessage(result.message);
          setVoiceTranscript('');
          setIsProcessingVoice(false);

          // Stop listening after successfully adding items
          setTimeout(() => {
            listeningRef.current = false;
            setIsListening(false);
            setVoiceMessage('');
            if (ExpoSpeechRecognitionModule) {
              try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
            }
          }, 1500);
          return;
        } else {
          setVoiceMessage(result.message || "Didn't catch that");
        }
      } catch (error) {
        console.error('Voice processing error:', error);
        setVoiceMessage('Error processing');
      } finally {
        setIsProcessingVoice(false);
      }
    }, 1500); // Wait 1.5s after user stops speaking
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[Voice] Session ended, listening:', listeningRef.current);
    // Restart if we should still be listening (like cooking mode)
    if (listeningRef.current && ExpoSpeechRecognitionModule) {
      setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
        } catch (e) {
          console.warn('[Voice] Restart failed:', e);
        }
      }, 300);
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    console.warn('[Voice] Error:', event?.error || event);
    // Restart on error if we should still be listening
    if (listeningRef.current && ExpoSpeechRecognitionModule) {
      setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
        } catch (e) {
          console.warn('[Voice] Restart after error failed:', e);
        }
      }, 1000);
    }
  });

  const startListening = useCallback(async () => {
    if (!VOICE_AVAILABLE) {
      Alert.alert('Voice Unavailable', 'Voice input is not available in Expo Go. Please use a development build.');
      return;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required for voice input.');
        return;
      }

      listeningRef.current = true;
      lastProcessedRef.current = '';
      setIsListening(true);
      setVoiceMessage('Listening...');
      setVoiceTranscript('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US', // Arabic, also understands English
        interimResults: true,
        continuous: true,
      });
      console.log('[Voice] Started continuous listening');
    } catch (error) {
      console.error('Failed to start voice:', error);
      listeningRef.current = false;
      setIsListening(false);
      setVoiceMessage('Could not start');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    listeningRef.current = false;
    setIsListening(false);
    setVoiceMessage('');
    setVoiceTranscript('');
    if (ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.warn('[Voice] Stop failed:', e);
      }
    }
    console.log('[Voice] Stopped');
  }, []);

  // Separate items
  const checkedItems = useMemo(() => items.filter(i => i.is_checked), [items]);
  const uncheckedItems = useMemo(() => items.filter(i => !i.is_checked), [items]);

  const generalItems = useMemo(() =>
    uncheckedItems.filter(i => !i.recipe_name),
    [uncheckedItems]
  );

  const recipeGroups = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    uncheckedItems.forEach(item => {
      if (item.recipe_name) {
        if (!groups[item.recipe_name]) groups[item.recipe_name] = [];
        groups[item.recipe_name].push(item);
      }
    });
    return groups;
  }, [uncheckedItems]);

  // Progress
  const totalItems = items.length;
  const completedItems = checkedItems.length;
  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  // Handlers
  const handleToggle = useCallback((id: string) => {
    toggleItem(id);
  }, [toggleItem]);

  const handleDelete = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    setDeletedItem(item);
    setShowUndo(true);
    RNAnimated.spring(undoAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
    removeItem(id);

    undoTimeoutRef.current = setTimeout(() => {
      RNAnimated.timing(undoAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
        setShowUndo(false);
        setDeletedItem(null);
      });
    }, 4000);
  }, [items, removeItem, undoAnim]);

  const handleUndo = useCallback(() => {
    if (!deletedItem) return;
    addItem(deletedItem);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    RNAnimated.timing(undoAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
      setShowUndo(false);
      setDeletedItem(null);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [deletedItem, addItem, undoAnim]);

  const handleQuickAdd = useCallback(() => {
    if (!quickAddText.trim()) return;
    addItem({ name: quickAddText.trim(), category: 'other' });
    setQuickAddText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [quickAddText, addItem]);

  const handleClearGeneral = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generalItems.forEach(item => removeItem(item.id));
  }, [generalItems, removeItem]);

  const handleClearRecipe = useCallback((recipeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const recipeItems = recipeGroups[recipeName] || [];
    recipeItems.forEach(item => removeItem(item.id));
  }, [recipeGroups, removeItem]);

  const handleClearChecked = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    checkedItems.forEach(item => removeItem(item.id));
  }, [checkedItems, removeItem]);

  // Empty state
  if (items.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <TabScreenTransition style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.headerTitle}>Grocery List</Text>
          </View>
          <EmptyState icon="cart-outline" title="Your list is empty" subtitle="Add items by voice or tap the + button" />

          {/* Voice listening overlay for empty state */}
          {isListening && (
            <View style={styles.emptyVoiceOverlay}>
              <View style={styles.voiceListeningContainer}>
                <View style={styles.voiceListeningHeader}>
                  <View style={styles.waveBarsContainer}>
                    {waveBars.map((bar, i) => (
                      <RNAnimated.View
                        key={i}
                        style={[
                          styles.waveBar,
                          { transform: [{ scaleY: bar }] },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.voiceListeningLabel}>
                    {isProcessingVoice ? 'Adding...' : 'Listening...'}
                  </Text>
                  <Pressable onPress={stopListening} style={styles.stopListeningBtn}>
                    <Ionicons name="close" size={20} color={C.charcoal} />
                  </Pressable>
                </View>
                {voiceTranscript ? (
                  <Text style={styles.voiceTranscript} numberOfLines={2}>
                    "{voiceTranscript}"
                  </Text>
                ) : (
                  <Text style={styles.voiceHint}>
                    Say what you need, e.g. "I need bread, milk, and eggs"
                  </Text>
                )}
                {voiceMessage && voiceMessage !== 'Listening...' && (
                  <Text style={styles.voiceResult}>{voiceMessage}</Text>
                )}
              </View>
            </View>
          )}

          {/* Bottom buttons */}
          <View style={[styles.emptyBottomButtons, { bottom: bottomTabBarHeight + 20 }]}>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={startListening}
            >
              <Ionicons name="mic" size={22} color={C.terracotta} />
              <Text style={styles.emptyActionText}>Voice</Text>
            </Pressable>
            <Pressable
              style={[styles.emptyActionBtn, styles.emptyActionBtnPrimary]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={22} color={C.ivory} />
              <Text style={[styles.emptyActionText, styles.emptyActionTextPrimary]}>Add Item</Text>
            </Pressable>
          </View>

          <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
        </TabScreenTransition>
      </GestureHandlerRootView>
    );
  }

  const hasUncheckedContent = generalItems.length > 0 || Object.keys(recipeGroups).length > 0;

  return (
    <GestureHandlerRootView style={styles.container}>
      <TabScreenTransition style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Grocery List</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>{completedItems} of {totalItems} items</Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAddWrap}>
          {isListening ? (
            // Voice listening mode
            <View style={styles.voiceListeningContainer}>
              <View style={styles.voiceListeningHeader}>
                <View style={styles.waveBarsContainer}>
                  {waveBars.map((bar, i) => (
                    <RNAnimated.View
                      key={i}
                      style={[
                        styles.waveBar,
                        { transform: [{ scaleY: bar }] },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.voiceListeningLabel}>
                  {isProcessingVoice ? 'Adding...' : 'Listening...'}
                </Text>
                <Pressable onPress={stopListening} style={styles.stopListeningBtn}>
                  <Ionicons name="close" size={20} color={C.charcoal} />
                </Pressable>
              </View>
              {voiceTranscript ? (
                <Text style={styles.voiceTranscript} numberOfLines={2}>
                  "{voiceTranscript}"
                </Text>
              ) : (
                <Text style={styles.voiceHint}>
                  Say what you need, e.g. "I need bread, milk, and eggs"
                </Text>
              )}
              {voiceMessage && voiceMessage !== 'Listening...' && (
                <Text style={styles.voiceResult}>{voiceMessage}</Text>
              )}
            </View>
          ) : (
            // Normal quick add input
            <View style={styles.quickAdd}>
              <TextInput
                style={styles.quickAddInput}
                placeholder="Add item..."
                placeholderTextColor={C.muted}
                value={quickAddText}
                onChangeText={setQuickAddText}
                onSubmitEditing={handleQuickAdd}
                returnKeyType="done"
              />
              {quickAddText.length > 0 ? (
                <Pressable onPress={handleQuickAdd} style={styles.quickAddSend}>
                  <Ionicons name="arrow-up-circle" size={28} color={C.terracotta} />
                </Pressable>
              ) : (
                <View style={styles.quickAddActions}>
                  <Pressable onPress={startListening} style={styles.micBtn}>
                    <Ionicons name="mic" size={18} color={C.terracotta} />
                  </Pressable>
                  <Pressable onPress={() => setShowAddModal(true)} style={styles.addDetailBtn}>
                    <Ionicons name="add" size={20} color={C.ivory} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: bottomTabBarHeight + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* General Section */}
          <Section
            title="General"
            subtitle="Misc. things you need"
            items={generalItems}
            onToggleItem={handleToggle}
            onDeleteItem={handleDelete}
            onClear={handleClearGeneral}
          />

          {/* Recipe Sections */}
          {Object.entries(recipeGroups).map(([recipeName, recipeItems]) => (
            <Section
              key={recipeName}
              title={recipeName}
              subtitle={`${recipeItems.length} ingredient${recipeItems.length !== 1 ? 's' : ''}`}
              items={recipeItems}
              onToggleItem={handleToggle}
              onDeleteItem={handleDelete}
              onClear={() => handleClearRecipe(recipeName)}
            />
          ))}

          {/* All done message when no unchecked items */}
          {!hasUncheckedContent && checkedItems.length > 0 && (
            <View style={styles.allDone}>
              <Ionicons name="checkmark-circle" size={40} color={C.gold} />
              <Text style={styles.allDoneText}>All done!</Text>
            </View>
          )}

          {/* Checked Section */}
          <CheckedSection
            items={checkedItems}
            onToggleItem={handleToggle}
            onDeleteItem={handleDelete}
            onClearAll={handleClearChecked}
          />
        </ScrollView>

        {/* Undo Snackbar */}
        {showUndo && deletedItem && (
          <RNAnimated.View style={[styles.undoSnackbar, { bottom: bottomTabBarHeight + 80, transform: [{ translateY: undoAnim }] }]}>
            <Text style={styles.undoText} numberOfLines={1}>Removed "{deletedItem.name}"</Text>
            <TouchableOpacity onPress={handleUndo}>
              <Text style={styles.undoBtn}>Undo</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}

        <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
      </TabScreenTransition>
    </GestureHandlerRootView>
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

  // Header
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },

  // Progress
  progressWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  progressPercent: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  progressTrack: {
    height: 4,
    backgroundColor: C.hairline,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: C.gold,
    borderRadius: 2,
  },

  // Quick Add
  quickAddWrap: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: C.ivory,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  quickAddInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    marginLeft: 8,
  },
  quickAddSend: {
    marginLeft: 8,
  },
  quickAddActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198, 110, 78, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDetailBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Voice listening container
  voiceListeningContainer: {
    backgroundColor: C.ivory,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.terracotta,
    padding: 16,
  },
  voiceListeningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waveBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: C.terracotta,
  },
  voiceListeningLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  stopListeningBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTranscript: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    marginTop: 12,
    fontStyle: 'italic',
  },
  voiceHint: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 12,
  },
  voiceResult: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
    marginTop: 8,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.charcoal,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: C.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: C.hairline,
    marginHorizontal: 24,
    marginBottom: 12,
  },

  // Item Row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 12,
  },
  itemImageWrap: {
    position: 'relative',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImageInner: {
    width: '100%',
    height: '100%',
  },
  itemEmoji: {
    fontSize: 28,
  },
  deleteBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: C.muted,
  },
  itemAmount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 1,
  },

  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ivory,
  },
  checkboxChecked: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },

  // Checked Section
  checkedSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
    paddingTop: 12,
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  checkedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkedTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  checkedCount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    backgroundColor: C.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  checkedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearCheckedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearCheckedText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  checkedItems: {
    marginTop: 4,
  },

  // All Done
  allDone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  allDoneText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },

  // Empty state bottom buttons
  emptyBottomButtons: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyVoiceOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '45%',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: C.ivory,
    borderWidth: 2,
    borderColor: C.terracotta,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyActionBtnPrimary: {
    backgroundColor: C.terracotta,
    borderColor: C.terracotta,
  },
  emptyActionText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  emptyActionTextPrimary: {
    color: C.ivory,
  },

  // Undo
  undoSnackbar: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: C.charcoal,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  undoText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.ivory,
    flex: 1,
  },
  undoBtn: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
    marginLeft: 16,
  },
});
