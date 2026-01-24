import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Animated, Image, TextInput } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { socialService, SocialPlatform, SocialVideoMetadata } from '@/services/social.service';
import { useRecipeStore } from '@/stores/recipeStore';
import { RecipePreview } from '@/components/recipe/RecipePreview';
import type { ExtractedRecipe } from '@/utils/types';

type ExtractionStage = 'idle' | 'extracting' | 'needsManualInput' | 'extracted';

interface PlatformConfig {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  placeholder: string;
  tips: string[];
}

const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  youtube: {
    name: 'YouTube',
    icon: 'logo-youtube',
    color: '#F2330D',
    bgColor: 'rgba(242, 51, 13, 0.12)',
    placeholder: 'https://youtube.com/watch?v=...',
    tips: [
      'Use videos with clear spoken instructions',
      'English videos work best',
      'Videos should have captions/subtitles',
      'Cooking tutorials are ideal',
    ],
  },
  tiktok: {
    name: 'TikTok',
    icon: 'logo-tiktok',
    color: '#000000',
    bgColor: 'rgba(0, 0, 0, 0.08)',
    placeholder: 'https://tiktok.com/@user/video/...',
    tips: [
      'Videos with recipe descriptions work best',
      'Look for videos with ingredient lists in captions',
      'Cooking hashtags help identify recipes',
      'You may need to add details for short videos',
    ],
  },
  instagram: {
    name: 'Instagram',
    icon: 'logo-instagram',
    color: '#E4405F',
    bgColor: 'rgba(228, 64, 95, 0.12)',
    placeholder: 'https://instagram.com/p/... or /reel/...',
    tips: [
      'Posts, Reels, and IGTV with recipe captions work best',
      'Public accounts are required',
      'Detailed captions help extraction',
      'You may need to add details manually',
    ],
  },
  unknown: {
    name: 'Video',
    icon: 'videocam',
    color: '#9C5749',
    bgColor: 'rgba(156, 87, 73, 0.12)',
    placeholder: 'Paste a video URL...',
    tips: [
      'Supported platforms: YouTube, TikTok, Instagram',
    ],
  },
};

export default function AddRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string; mode?: string }>();
  const { addRecipe } = useRecipeStore();

  // Determine initial platform from URL params
  const initialPlatform = (params.platform as SocialPlatform) || 'unknown';

  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<SocialPlatform>(initialPlatform);
  const [stage, setStage] = useState<ExtractionStage>('idle');
  const [extractingProgress, setExtractingProgress] = useState(0);
  const [extractingStage, setExtractingStage] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState('');
  const [videoMetadata, setVideoMetadata] = useState<SocialVideoMetadata | null>(null);
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get platform config based on detected platform
  const platformConfig = PLATFORM_CONFIGS[detectedPlatform] || PLATFORM_CONFIGS.unknown;

  // Auto-detect platform when URL changes
  useEffect(() => {
    if (url.trim()) {
      const detected = socialService.detectPlatform(url.trim());
      if (detected !== 'unknown') {
        setDetectedPlatform(detected);
      }
    }
  }, [url]);

  // Animation for extraction
  useEffect(() => {
    if (stage === 'extracting') {
      // Shimmer animation for progress bar
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulse animation for AI badge
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [stage]);

  const handleExtract = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    const platform = socialService.detectPlatform(url.trim());
    if (platform === 'unknown') {
      Alert.alert('Error', 'Please enter a valid YouTube, TikTok, or Instagram URL');
      return;
    }

    try {
      setStage('extracting');
      setExtractingProgress(0);
      setErrorMessage('');
      setDetectedPlatform(platform);

      const result = await socialService.extractRecipe(url.trim(), (progress) => {
        setExtractingProgress(progress.progress);
        setExtractingStage(progress.stage);
      });

      // Update metadata and thumbnail
      if (result.metadata) {
        setVideoMetadata(result.metadata);
        if (result.metadata.thumbnailUrl) {
          setVideoThumbnail(result.metadata.thumbnailUrl);
        }
      }

      if (result.success && result.recipe) {
        setExtractingProgress(100);
        setExtractedRecipe(result.recipe);
        setSourceUrl(url.trim());
        setStage('extracted');
      } else if (result.needsManualInput) {
        // Need to fall back to manual input
        setStage('needsManualInput');
        setErrorMessage(result.error || 'Could not extract recipe automatically.');
      } else {
        setStage('idle');
        Alert.alert('Error', result.error || 'Failed to extract recipe');
      }
    } catch (error: any) {
      setStage('idle');
      Alert.alert('Error', error.message || 'Failed to extract recipe');
    }
  };

  const handleManualExtract = async () => {
    if (!manualDescription.trim()) {
      Alert.alert('Error', 'Please enter the recipe description');
      return;
    }

    try {
      setStage('extracting');
      setExtractingProgress(30);
      setExtractingStage('Processing your input...');

      const result = await socialService.extractRecipeFromManualInput(
        manualDescription.trim(),
        videoMetadata || undefined,
        (progress) => {
          setExtractingProgress(progress.progress);
          setExtractingStage(progress.stage);
        }
      );

      if (result.success && result.recipe) {
        setExtractingProgress(100);
        setExtractedRecipe(result.recipe);
        setSourceUrl(url.trim());
        setStage('extracted');
      } else {
        setStage('needsManualInput');
        Alert.alert('Error', result.error || 'Failed to extract recipe. Please provide more details.');
      }
    } catch (error: any) {
      setStage('needsManualInput');
      Alert.alert('Error', error.message || 'Failed to process recipe');
    }
  };

  const handleTryVision = async () => {
    if (!videoThumbnail || !videoMetadata) {
      Alert.alert('Error', 'No video thumbnail available for vision analysis');
      return;
    }

    try {
      setStage('extracting');
      setExtractingProgress(20);
      setExtractingStage('Analyzing video thumbnail...');

      const result = await socialService.extractRecipeFromVision(
        videoThumbnail,
        videoMetadata,
        (progress) => {
          setExtractingProgress(progress.progress);
          setExtractingStage(progress.stage);
        }
      );

      if (result.success && result.recipe) {
        setExtractingProgress(100);
        setExtractedRecipe(result.recipe);
        setSourceUrl(url.trim());
        setStage('extracted');
      } else {
        setStage('needsManualInput');
        setErrorMessage(result.error || 'Vision analysis could not identify the recipe.');
      }
    } catch (error: any) {
      setStage('needsManualInput');
      setErrorMessage(error.message || 'Vision analysis failed');
    }
  };

  const handleSave = async () => {
    if (!extractedRecipe) return;

    try {
      setIsSaving(true);

      await addRecipe(extractedRecipe, sourceUrl);

      setIsSaving(false);
      Alert.alert('Success', 'Recipe saved!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      setIsSaving(false);
      Alert.alert('Error', error.message || 'Failed to save recipe');
    }
  };

  const handleReset = () => {
    setExtractedRecipe(null);
    setUrl('');
    setSourceUrl('');
    setVideoThumbnail('');
    setVideoMetadata(null);
    setExtractingProgress(0);
    setExtractingStage('');
    setStage('idle');
    setManualDescription('');
    setErrorMessage('');
    setDetectedPlatform(initialPlatform);
  };

  // Extracted recipe preview
  if (stage === 'extracted' && extractedRecipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <RecipePreview
          recipe={extractedRecipe}
          onSave={handleSave}
          onEdit={() => {}}
          onDiscard={handleReset}
          isSaving={isSaving}
        />
      </View>
    );
  }

  // Manual input fallback UI
  if (stage === 'needsManualInput') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButtonTouch}
              onPress={handleReset}
            >
              <Ionicons name="arrow-back" size={20} color="#1C100D" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Add Details</Text>
            <View style={styles.topSpacer} />
          </View>

          {/* Thumbnail Preview */}
          {videoThumbnail ? (
            <View style={styles.thumbnailPreview}>
              <Image source={{ uri: videoThumbnail }} style={styles.thumbnailSmall} />
              <View style={styles.thumbnailInfo}>
                <Text style={styles.thumbnailTitle} numberOfLines={2}>
                  {videoMetadata?.title || 'Video'}
                </Text>
                <Text style={styles.thumbnailAuthor}>
                  {videoMetadata?.author || platformConfig.name}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Message */}
          <View style={styles.errorBox}>
            <Ionicons name="information-circle" size={24} color="#F2330D" />
            <Text style={styles.errorText}>
              {errorMessage || "We couldn't extract the recipe automatically. Please provide the recipe details below."}
            </Text>
          </View>

          {/* Vision Fallback Option */}
          {videoThumbnail && (
            <TouchableOpacity style={styles.visionButton} onPress={handleTryVision}>
              <Ionicons name="eye" size={20} color="#9C5749" />
              <Text style={styles.visionButtonText}>Try AI Vision Analysis</Text>
            </TouchableOpacity>
          )}

          {/* Manual Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Recipe Description</Text>
            <Text style={styles.inputHint}>
              Include ingredients, amounts, and cooking steps
            </Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Example: 2 cups flour, 1 cup sugar, 2 eggs. Mix dry ingredients, add eggs, bake at 350F for 30 minutes..."
              value={manualDescription}
              onChangeText={setManualDescription}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholderTextColor="#9C5749"
            />
          </View>

          <TouchableOpacity
            style={[styles.extractButton, !manualDescription.trim() && styles.extractButtonDisabled]}
            onPress={handleManualExtract}
            disabled={!manualDescription.trim()}
            activeOpacity={0.9}
          >
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={styles.extractButtonText}>Extract Recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleReset}>
            <Text style={styles.cancelButtonText}>Start Over</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Extracting state UI
  if (stage === 'extracting') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButtonTouch}
              onPress={() => {
                setStage('idle');
                handleReset();
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#1C100D" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>New Recipe</Text>
            <View style={styles.topSpacer} />
          </View>

          {/* Input Section (read-only) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Video Link</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText} numberOfLines={1}>{url}</Text>
              <View style={styles.linkIconContainer}>
                <Ionicons name="link" size={20} color="#9C5749" />
              </View>
            </View>
            <TouchableOpacity style={styles.extractingButton} disabled>
              <Ionicons name="sync" size={20} color="#FFFFFF" style={styles.spinIcon} />
              <Text style={styles.extractingButtonText}>Extracting...</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* AI Feedback Zone */}
          <Animated.View style={[styles.aiFeedbackZone, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.thumbnailContainer}>
              {videoThumbnail ? (
                <Image source={{ uri: videoThumbnail }} style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Ionicons name={platformConfig.icon} size={40} color={platformConfig.color} />
                </View>
              )}
              <View style={styles.thumbnailOverlay} />
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={18} color="#F2330D" />
                <Text style={styles.aiBadgeText}>AI Chef is active</Text>
              </View>
            </View>

            <View style={styles.extractingInfo}>
              <Text style={styles.extractingTitle}>Cooking up your recipe...</Text>
              <Text style={styles.extractingSubtitle}>
                Our AI is analyzing the {platformConfig.name} video and identifying ingredients for you.
              </Text>
            </View>
          </Animated.View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{extractingStage}</Text>
              <Text style={styles.progressPercent}>{extractingProgress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${extractingProgress}%` },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressShimmer,
                    {
                      transform: [{
                        translateX: shimmerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-100, 200],
                        }),
                      }],
                    },
                  ]}
                />
              </Animated.View>
            </View>
          </View>

          {/* Skeleton Content */}
          <View style={styles.skeletonSection}>
            <View style={styles.skeletonGroup}>
              <View style={styles.skeletonLabel} />
              <View style={styles.skeletonTags}>
                <View style={[styles.skeletonTag, { width: 80 }]} />
                <View style={[styles.skeletonTag, { width: 112 }]} />
                <View style={[styles.skeletonTag, { width: 64 }]} />
              </View>
            </View>
            <View style={styles.skeletonGroup}>
              <View style={styles.skeletonLabel} />
              <View style={styles.skeletonStep}>
                <View style={styles.skeletonCircle} />
                <View style={styles.skeletonLines}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '90%' }]} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Default input state
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButtonTouch}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#1C100D" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>New Recipe</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: platformConfig.bgColor }]}>
            <Ionicons name={platformConfig.icon} size={32} color={platformConfig.color} />
          </View>

          <Text style={styles.title}>Add from {platformConfig.name}</Text>
          <Text style={styles.subtitle}>
            Paste a {platformConfig.name.toLowerCase()} video URL and we'll extract the recipe automatically.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Video Link</Text>
          <View style={styles.urlInputContainer}>
            <TextInput
              placeholder={platformConfig.placeholder}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.urlInput}
              placeholderTextColor="#9C5749"
            />
            <View style={styles.linkIconContainer}>
              <Ionicons name="link" size={20} color="#9C5749" />
            </View>
          </View>

          {/* Platform Detection Badge */}
          {url.trim() && detectedPlatform !== 'unknown' && detectedPlatform !== initialPlatform && (
            <View style={styles.platformBadge}>
              <Ionicons name={PLATFORM_CONFIGS[detectedPlatform].icon} size={14} color={PLATFORM_CONFIGS[detectedPlatform].color} />
              <Text style={styles.platformBadgeText}>
                Detected: {PLATFORM_CONFIGS[detectedPlatform].name}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.extractButton, !url.trim() && styles.extractButtonDisabled]}
          onPress={handleExtract}
          disabled={!url.trim()}
          activeOpacity={0.9}
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.extractButtonText}>Extract Recipe</Text>
        </TouchableOpacity>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Tips for best results:</Text>
          {platformConfig.tips.map((tip, index) => (
            <Text key={index} style={styles.tip}>• {tip}</Text>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButtonTouch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  topSpacer: {
    width: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
  },
  subtitle: {
    textAlign: 'center',
    color: '#9C5749',
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 16,
    fontFamily: 'NotoSans_500Medium',
  },

  // Input Section
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#1C100D',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 15,
    marginBottom: 8,
  },
  inputHint: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    borderRadius: 14,
    overflow: 'hidden',
  },
  urlInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 15,
    color: '#1C100D',
  },
  linkIconContainer: {
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#E8D3CE',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    borderRadius: 14,
    overflow: 'hidden',
    opacity: 0.8,
    marginBottom: 12,
  },
  readOnlyText: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 15,
    color: '#1C100D',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F7F1EE',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  platformBadgeText: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 12,
  },

  // Manual Input
  manualInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    borderRadius: 14,
    padding: 16,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 15,
    color: '#1C100D',
    minHeight: 160,
  },

  // Extract Button
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 14,
    height: 52,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  extractButtonDisabled: {
    backgroundColor: 'rgba(242, 51, 13, 0.5)',
    shadowOpacity: 0,
  },
  extractButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Extracting Button
  extractingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(242, 51, 13, 0.9)',
    borderRadius: 14,
    height: 52,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  extractingButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  spinIcon: {
    // Note: React Native doesn't have CSS animations, we'd need Animated for spin
  },

  // Cancel Button
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  cancelButtonText: {
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 15,
    color: '#9C5749',
  },

  // Vision Button
  visionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F7F1EE',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  visionButtonText: {
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 14,
    color: '#9C5749',
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 14,
    color: '#1C100D',
    lineHeight: 20,
  },

  // Thumbnail Preview
  thumbnailPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    marginBottom: 16,
  },
  thumbnailSmall: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  thumbnailInfo: {
    flex: 1,
  },
  thumbnailTitle: {
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 14,
    color: '#1C100D',
    marginBottom: 4,
  },
  thumbnailAuthor: {
    fontFamily: 'NotoSans_500Medium',
    fontSize: 12,
    color: '#9C5749',
  },

  divider: {
    height: 1,
    backgroundColor: '#E8D3CE',
    marginVertical: 16,
  },

  // AI Feedback Zone
  aiFeedbackZone: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  thumbnailContainer: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8D3CE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F1EE',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  aiBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  aiBadgeText: {
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 13,
    color: '#1C100D',
  },
  extractingInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  extractingTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#1C100D',
    textAlign: 'center',
    marginBottom: 8,
  },
  extractingSubtitle: {
    fontFamily: 'NotoSans_500Medium',
    fontSize: 14,
    color: '#9C5749',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Progress Bar
  progressSection: {
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 12,
    color: '#F2330D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressPercent: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 12,
    color: '#9C5749',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E8D3CE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F2330D',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },

  // Skeleton
  skeletonSection: {
    paddingHorizontal: 8,
    gap: 24,
  },
  skeletonGroup: {
    gap: 12,
  },
  skeletonLabel: {
    height: 20,
    width: 96,
    backgroundColor: '#E8D3CE',
    borderRadius: 4,
  },
  skeletonTags: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonTag: {
    height: 32,
    backgroundColor: '#F7F1EE',
    borderRadius: 8,
  },
  skeletonStep: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8D3CE',
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    width: '100%',
    backgroundColor: '#F7F1EE',
    borderRadius: 4,
  },

  // Tips
  tips: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  tipsTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 12,
  },
  tip: {
    color: '#9C5749',
    fontSize: 14,
    lineHeight: 26,
    fontFamily: 'NotoSans_500Medium',
  },
});
