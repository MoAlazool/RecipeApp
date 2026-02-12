import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  type DimensionValue,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { aiService } from '@/services/ai.service';
import { firebaseService } from '@/services/firebase.service';
import { pantryService } from '@/services/pantry.service';
import { useUsageStore } from '@/stores/usageStore';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import {
  getIngredientEmoji,
  CATEGORY_BG_COLORS,
  generateMarkerPosition,
  confidenceToPercent,
} from '@/utils/ingredientEmojis';
import { getIngredientImage } from '@/utils/ingredientImages';
import type { DetectedIngredient } from '@/utils/types';

// ============================================================
// DESIGN TOKENS — Matching Recipe Detail Screen
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
  olive: '#6B8E23',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

interface DetectedItem {
  id: string;
  name: string;
  emoji: string;
  confidence: number;
  quantity: string;
  category: string;
  position: { top: DimensionValue; left: DimensionValue };
  bgColor: string;
}

// ============================================================
// HELPERS
// ============================================================

function mapDetectedIngredientsToItems(ingredients: DetectedIngredient[]): DetectedItem[] {
  return ingredients.map((ingredient, index) => {
    const bgColor = CATEGORY_BG_COLORS[ingredient.category as keyof typeof CATEGORY_BG_COLORS] || '#F5F3EE';
    const confidence = ingredient.confidence_percent ?? confidenceToPercent(ingredient.confidence);
    return {
      id: `${index + 1}`,
      name: ingredient.name,
      emoji: getIngredientEmoji(ingredient.name),
      confidence,
      quantity: ingredient.quantity_estimate || 'some',
      category: ingredient.category || 'other',
      position: generateMarkerPosition(index, ingredients.length),
      bgColor,
    };
  });
}

// ============================================================
// PULSING MARKER COMPONENT
// ============================================================

function PulsingMarker({ isPrimary = false, delay = 0 }: { isPrimary?: boolean; delay?: number }) {
  const pulseAnim = useRef(new RNAnimated.Value(0.8)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0.5)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.parallel([
          RNAnimated.timing(pulseAnim, { toValue: 2.5, duration: 2000, useNativeDriver: true }),
          RNAnimated.timing(opacityAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
        RNAnimated.parallel([
          RNAnimated.timing(pulseAnim, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          RNAnimated.timing(opacityAnim, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [delay, pulseAnim, opacityAnim]);

  return (
    <View style={styles.markerContainer}>
      <RNAnimated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: isPrimary ? 'rgba(198, 110, 78, 0.5)' : 'rgba(255, 255, 255, 0.5)',
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      <View
        style={[
          styles.markerDot,
          {
            backgroundColor: isPrimary ? C.terracotta : '#FFFFFF',
            borderColor: isPrimary ? '#FFFFFF' : C.terracotta,
          },
        ]}
      />
    </View>
  );
}

// ============================================================
// DETECTED ITEM ROW COMPONENT
// ============================================================

interface DetectedItemRowProps {
  item: DetectedItem;
  index: number;
  onRemove: (id: string) => void;
  isViewOnly?: boolean;
}

function DetectedItemRow({ item, index, onRemove, isViewOnly = false }: DetectedItemRowProps) {
  const ingredientImage = getIngredientImage(item.name);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={styles.itemRow}>
        <View style={[styles.itemEmoji, { backgroundColor: item.bgColor }]}>
          {ingredientImage ? (
            <ExpoImage source={ingredientImage} style={styles.itemEmojiImage} contentFit="cover" />
          ) : (
            <Text style={styles.emojiText}>{item.emoji}</Text>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.quantityBadge}>
              <Ionicons name="cube-outline" size={11} color={C.olive} />
              <Text style={styles.quantityText}>{item.quantity}</Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{item.confidence}%</Text>
            </View>
          </View>
        </View>
        {!isViewOnly && (
          <Pressable
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRemove(item.id);
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={C.muted} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function FridgeReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string; scanId?: string; viewOnly?: string }>();
  const insets = useSafeAreaInsets();

  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();

  const [items, setItems] = useState<DetectedItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [scanDate, setScanDate] = useState<string | null>(null);

  const isViewOnly = params.viewOnly === 'true';
  const imageUri = params.imageUri || 'https://via.placeholder.com/800x600';

  useEffect(() => {
    if (params.scanId && isViewOnly) {
      loadPreviousScan();
    } else {
      gatedAnalyze();
    }
  }, []);

  const loadPreviousScan = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      const scan = await firebaseService.getFridgeScan(params.scanId!);
      if (!scan) {
        setError('Scan not found');
        return;
      }

      const detectedItems = mapDetectedIngredientsToItems(scan.ingredients);
      setItems(detectedItems);
      setScanDate(scan.created_at);
    } catch (err) {
      console.error('Failed to load scan:', err);
      setError('Failed to load scan. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const gatedAnalyze = async () => {
    const allowed = await checkGate('scan');
    if (!allowed) {
      setIsAnalyzing(false);
      return;
    }
    analyzeImage();
  };

  const analyzeImage = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      // Count usage before the API call to prevent bypass
      await useUsageStore.getState().incrementUsage('scan');

      let base64: string;
      if (imageUri.startsWith('http') || imageUri.startsWith('data:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        try {
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }

      const result = await aiService.analyzeFridgeImage(base64);
      const detectedItems = mapDetectedIngredientsToItems(result.ingredients);
      setItems(detectedItems);

      try {
        await pantryService.saveFridgeItems(result.ingredients, imageUri);
      } catch (saveError: any) {
        console.error('Failed to save pantry items:', saveError);
      }
    } catch (err) {
      console.error('Failed to analyze image:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleAddItem = () => {
    setShowAddModal(true);
    setManualItemName('');
  };

  const handleConfirmAddItem = () => {
    if (!manualItemName.trim()) return;

    const newItem: DetectedItem = {
      id: `manual-${Date.now()}`,
      name: manualItemName.trim(),
      emoji: getIngredientEmoji(manualItemName.trim()),
      confidence: 100,
      quantity: 'some',
      category: 'other',
      position: generateMarkerPosition(items.length, items.length + 1),
      bgColor: CATEGORY_BG_COLORS['other'] || '#F5F3EE',
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddModal(false);
    setManualItemName('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRetake = () => {
    router.back();
  };

  const handleClose = () => {
    router.dismiss();
  };

  const handleRetry = () => {
    gatedAnalyze();
  };

  const handleFindRecipes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const selectedItems = items.map((item) => ({
      name: item.name,
      emoji: item.emoji,
    }));

    router.replace({
      pathname: '/recipe-preferences',
      params: { ingredients: JSON.stringify(selectedItems), sourceType: 'fridge_scan' },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image */}
      <View style={styles.imageContainer}>
        <ExpoImage source={{ uri: imageUri }} style={styles.backgroundImage} contentFit="cover" />
        <View style={styles.imageOverlay} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
          onPress={handleClose}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="close" size={20} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isViewOnly ? 'Previous Scan' : 'Review Photo'}
        </Text>
        {!isViewOnly ? (
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            onPress={handleRetake}
          >
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="refresh" size={18} color="#FFF" />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {/* Detection Markers */}
      <View style={styles.markersContainer} pointerEvents="none">
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.markerPosition, { top: item.position.top, left: item.position.left }]}
          >
            <PulsingMarker isPrimary={index === 0} delay={index * 300} />
          </View>
        ))}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetContent}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header Row */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.detectionLabel}>
                {isAnalyzing ? 'Scanning...' : error ? 'Error' : isViewOnly ? 'Saved Scan' : 'Detection Complete'}
              </Text>
              <Text style={styles.itemCount}>
                {isAnalyzing
                  ? isViewOnly ? 'Loading scan...' : 'AI is analyzing...'
                  : error
                  ? 'Please try again'
                  : isViewOnly && scanDate
                  ? new Date(scanDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : `${items.length} Items Found`}
              </Text>
            </View>
            {!isAnalyzing && !error && !isViewOnly && (
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                onPress={handleAddItem}
              >
                <Ionicons name="add" size={20} color={C.charcoal} />
              </Pressable>
            )}
          </View>

          {/* Loading State */}
          {isAnalyzing && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingIcon}>
                <ActivityIndicator size="large" color={C.gold} />
              </View>
              <Text style={styles.loadingText}>
                Identifying ingredients in your fridge...
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && !isAnalyzing && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle-outline" size={40} color={C.terracotta} />
              </View>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={18} color="#FFF" />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {/* Items List */}
          {!isAnalyzing && !error && (
            <ScrollView
              style={styles.itemsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.itemsListContent,
                isViewOnly && { paddingBottom: insets.bottom || 24 },
              ]}
            >
              {items.map((item, index) => (
                <DetectedItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onRemove={handleRemoveItem}
                  isViewOnly={isViewOnly}
                />
              ))}
            </ScrollView>
          )}

          {/* Find Recipes Button */}
          {!isAnalyzing && !error && items.length > 0 && !isViewOnly && (
            <View style={{ paddingBottom: insets.bottom || 24 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.findRecipesBtn,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                ]}
                onPress={handleFindRecipes}
              >
                <Ionicons name="sparkles" size={20} color="#FFF" />
                <Text style={styles.findRecipesBtnText}>Find Recipes</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Usage Limit Sheet */}
      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />

      {/* Add Manual Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowAddModal(false)} />
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={C.muted} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Tomatoes, Milk, Eggs..."
                placeholderTextColor={C.muted}
                value={manualItemName}
                onChangeText={setManualItemName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmAddItem}
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  !manualItemName.trim() && styles.modalBtnDisabled,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleConfirmAddItem}
                disabled={!manualItemName.trim()}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.modalConfirmText}>Add Item</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },

  // Background
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Markers
  markersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  markerPosition: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  markerContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  sheetContent: {
    backgroundColor: C.ivory,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 21, 16, 0.1)',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 20,
  },
  detectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  itemCount: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.cardBg,
    borderWidth: 0.5,
    borderColor: C.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(198, 110, 78, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.charcoal,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFF',
  },

  // Items List
  itemsList: {
    maxHeight: 320,
    paddingHorizontal: 24,
  },
  itemsListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  itemEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemEmojiImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  emojiText: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107, 142, 35, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quantityText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.olive,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confidenceText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.muted,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Find Recipes Button
  findRecipesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.terracotta,
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  findRecipesBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: C.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: C.charcoal,
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  textInput: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    borderWidth: 0.5,
    borderColor: C.hairline,
    paddingHorizontal: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: C.charcoal,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.muted,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.terracotta,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
