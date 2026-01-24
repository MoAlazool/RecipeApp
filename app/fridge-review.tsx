import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Animated,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { aiService } from '@/services/ai.service';
import { firebaseService } from '@/services/firebase.service';
import { pantryService } from '@/services/pantry.service';
import {
  getIngredientEmoji,
  getIngredientColors,
  generateMarkerPosition,
  confidenceToPercent,
} from '@/utils/ingredientEmojis';
import type { DetectedIngredient } from '@/utils/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DetectedItem {
  id: string;
  name: string;
  emoji: string;
  confidence: number;
  position: { top: string; left: string };
  bgColor: string;
  darkBgColor: string;
}

// Helper to convert AI DetectedIngredient to UI DetectedItem
function mapDetectedIngredientsToItems(
  ingredients: DetectedIngredient[]
): DetectedItem[] {
  return ingredients.map((ingredient, index) => {
    const colors = getIngredientColors(ingredient.category);
    const confidence = ingredient.confidence_percent ?? confidenceToPercent(ingredient.confidence);
    return {
      id: `${index + 1}`,
      name: ingredient.name,
      emoji: getIngredientEmoji(ingredient.name),
      confidence,
      position: generateMarkerPosition(index, ingredients.length),
      bgColor: colors.bgColor,
      darkBgColor: colors.darkBgColor,
    };
  });
}

function PulsingMarker({
  isPrimary = false,
  delay = 0,
}: {
  isPrimary?: boolean;
  delay?: number;
}) {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 2.5,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.5,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };
    startAnimation();
  }, [delay, pulseAnim, opacityAnim]);

  return (
    <View style={styles.markerContainer}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: isPrimary
              ? 'rgba(242, 51, 13, 0.5)'
              : 'rgba(255, 255, 255, 0.5)',
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      <View
        style={[
          styles.markerDot,
          {
            backgroundColor: isPrimary ? '#F2330D' : '#FFFFFF',
            borderColor: isPrimary ? '#FFFFFF' : '#F2330D',
          },
        ]}
      />
    </View>
  );
}

function DetectedItemRow({
  item,
  onRemove,
  isDark,
  isViewOnly = false,
}: {
  item: DetectedItem;
  onRemove: (id: string) => void;
  isDark: boolean;
  isViewOnly?: boolean;
}) {
  return (
    <View
      style={[
        styles.itemRow,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
        },
      ]}
    >
      <View style={styles.itemInfo}>
        <View
          style={[
            styles.itemEmoji,
            { backgroundColor: isDark ? item.darkBgColor : item.bgColor },
          ]}
        >
          <Text style={styles.emojiText}>{item.emoji}</Text>
        </View>
        <View style={styles.itemTextContainer}>
          <Text
            style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.itemConfidence,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {item.confidence}% confidence
          </Text>
        </View>
      </View>
      {!isViewOnly && (
        <Pressable
          style={styles.deleteButton}
          onPress={() => onRemove(item.id)}
          hitSlop={8}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={isDark ? '#9CA3AF' : '#9CA3AF'}
          />
        </Pressable>
      )}
    </View>
  );
}

export default function FridgeReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string; scanId?: string; viewOnly?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [items, setItems] = useState<DetectedItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [scanDate, setScanDate] = useState<string | null>(null);

  const isViewOnly = params.viewOnly === 'true';
  const imageUri =
    params.imageUri ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCwWnH5Buhj6z60_18QC_n14Ord9RRbLRpqQSDTzGDNqJ9kYeh4bFvLwI6TZ_06ZgMhwRSSvzp12BchvZco7IpsEbgzTSIquW8GUU7vj3K1oTqKu6hVCl5Aa1ALsNuSLcmv1In4NecyBF6ORiqs-LrNvB9d3Oo3B3JD_0ViJbqfAsnHVNkPeQgixy1NiLWl1Z_91GmAP-KPpYeoy4ZBWs9TjT-yLBkYGs1N_-lDhT290uolSomJmIs8J9sXzYX6kpmpVCycFfSb3s8';

  // Analyze the fridge image when the screen loads
  useEffect(() => {
    if (params.scanId && isViewOnly) {
      loadPreviousScan();
    } else {
      analyzeImage();
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

  const analyzeImage = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      // Convert image URI to base64
      let base64: string;
      if (imageUri.startsWith('http') || imageUri.startsWith('data:')) {
        // For remote URLs or data URIs, fetch and convert
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
      } else if (FileSystem?.EncodingType?.Base64) {
        // For local file URIs, use FileSystem
        base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        // Fallback: try fetch for file:// URIs
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

      // Call AI service to analyze the image
      const result = await aiService.analyzeFridgeImage(base64);

      // Map detected ingredients to UI format
      const detectedItems = mapDetectedIngredientsToItems(result.ingredients);
      setItems(detectedItems);

      // Increment usage counter
      await firebaseService.incrementUsage('scan');
    } catch (err) {
      console.error('Failed to analyze image:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

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
      confidence: 100, // Manual items have 100% confidence
      position: generateMarkerPosition(items.length, items.length + 1),
      bgColor: getIngredientColors('other').bgColor,
      darkBgColor: getIngredientColors('other').darkBgColor,
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddModal(false);
    setManualItemName('');
  };

  const handleRetake = () => {
    router.back();
  };

  const handleClose = () => {
    router.dismiss();
  };

  const handleRetry = () => {
    analyzeImage();
  };

  const handleAnalyze = async () => {
    // Navigate to recipe results immediately (don't block on save)
    const selectedItems = items.map((item) => ({
      name: item.name,
      emoji: item.emoji,
    }));

    router.push({
      pathname: '/recipe-results',
      params: { ingredients: JSON.stringify(selectedItems) },
    });

    // Save items to Firebase pantry in background
    try {
      const detectedIngredients: DetectedIngredient[] = items.map((item) => ({
        name: item.name,
        category: 'other' as any,
        quantity_estimate: '1',
        confidence: item.confidence > 80 ? 'high' : item.confidence > 50 ? 'medium' : 'low',
        confidence_percent: item.confidence,
      }));

      await pantryService.saveFridgeItems(detectedIngredients, imageUri);
      console.log('✅ Pantry items saved successfully');
    } catch (error: any) {
      console.error('Failed to save pantry items:', error);

      // Show helpful error message if it's a permission issue
      if (error.message?.includes('Permission denied')) {
        setTimeout(() => {
          Alert.alert(
            'Setup Required',
            'To save fridge items, please update your Firestore security rules. Check the Firebase Console → Firestore → Rules tab.',
            [{ text: 'OK' }]
          );
        }, 1000); // Delay so it doesn't interfere with navigation
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.backgroundImage} />
        <View style={styles.gradient} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.headerButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isViewOnly ? 'Previous Scan' : 'Review Photo'}
        </Text>
        {!isViewOnly && (
          <Pressable style={styles.headerButton} onPress={handleRetake}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </Pressable>
        )}
        {isViewOnly && <View style={styles.headerButton} />}
      </View>

      {/* Detection Markers */}
      <View style={styles.markersContainer} pointerEvents="none">
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.markerPosition,
              { top: item.position.top, left: item.position.left },
            ]}
          >
            <PulsingMarker isPrimary={index === 0} delay={index * 300} />
          </View>
        ))}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View
          style={[
            styles.sheetContent,
            { backgroundColor: isDark ? '#1A0F0D' : '#F8F6F5' },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(156,163,175,0.6)',
                },
              ]}
            />
          </View>

          {/* Header Row */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.detectionLabel}>
                {isAnalyzing ? 'Loading...' : error ? 'Error' : isViewOnly ? 'Saved Scan' : 'Detection Complete'}
              </Text>
              <Text
                style={[
                  styles.itemCount,
                  { color: isDark ? '#FFFFFF' : '#221310' },
                ]}
              >
                {isAnalyzing
                  ? (isViewOnly ? 'Loading scan...' : 'Scanning your fridge...')
                  : error
                  ? 'Please try again'
                  : isViewOnly && scanDate
                  ? new Date(scanDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : `${items.length} Items Found`}
              </Text>
            </View>
            {!isAnalyzing && !error && !isViewOnly && (
              <Pressable
                style={[
                  styles.addButton,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' },
                ]}
                onPress={handleAddItem}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={isDark ? '#D1D5DB' : '#4B5563'}
                />
              </Pressable>
            )}
          </View>

          {/* Loading State */}
          {isAnalyzing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F2330D" />
              <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                AI is analyzing your fridge contents...
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && !isAnalyzing && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {error}
              </Text>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
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
                isViewOnly && { paddingBottom: insets.bottom || 24 }
              ]}
            >
              {items.map((item) => (
                <DetectedItemRow
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveItem}
                  isDark={isDark}
                  isViewOnly={isViewOnly}
                />
              ))}
            </ScrollView>
          )}

          {/* Analyze Button */}
          {!isAnalyzing && !error && items.length > 0 && !isViewOnly && (
            <View style={{ paddingBottom: insets.bottom || 24 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.analyzeButton,
                  pressed && styles.analyzeButtonPressed,
                ]}
                onPress={handleAnalyze}
              >
                <Ionicons
                  name="sparkles"
                  size={20}
                  color="#FFFFFF"
                  style={styles.sparkleIcon}
                />
                <Text style={styles.analyzeButtonText}>Find Recipes</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

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
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAddModal(false)}
          />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#1A0F0D' : '#FFFFFF' },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                Add Item Manually
              </Text>
              <Pressable
                onPress={() => setShowAddModal(false)}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? '#9CA3AF' : '#64748B'}
                />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? '#D1D5DB' : '#64748B' },
                ]}
              >
                Item Name
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                  },
                ]}
                placeholder="e.g., Tomatoes, Milk, Eggs..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={manualItemName}
                onChangeText={setManualItemName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmAddItem}
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalCancelButton,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : '#F3F4F6',
                  },
                ]}
                onPress={() => setShowAddModal(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: isDark ? '#D1D5DB' : '#64748B' },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  !manualItemName.trim() && styles.modalButtonDisabled,
                ]}
                onPress={handleConfirmAddItem}
                disabled={!manualItemName.trim()}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.modalConfirmButtonText}>Add Item</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
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
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    // Simulating gradient with overlays
    borderTopWidth: 200,
    borderTopColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 150,
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
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
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  sheetContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 24,
  },
  detectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  itemCount: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 28,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsList: {
    maxHeight: 340,
    paddingHorizontal: 24,
  },
  itemsListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemEmoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 20,
  },
  itemTextContainer: {
    gap: 2,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  itemConfidence: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2330D',
    marginHorizontal: 24,
    marginTop: 24,
    height: 56,
    borderRadius: 12,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  analyzeButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  sparkleIcon: {
    marginRight: 4,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2330D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
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
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  textInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'NotoSans_400Regular',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  modalConfirmButton: {
    backgroundColor: '#F2330D',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
