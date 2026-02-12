import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Animated, Image, TextInput } from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { socialService, SocialPlatform, SocialVideoMetadata } from '@/services/social.service';
import { useRecipeStore } from '@/stores/recipeStore';
import { RecipePreview } from '@/components/recipe/RecipePreview';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import { useUsageStore } from '@/stores/usageStore';
import { useAuthStore } from '@/stores/authStore';
import { FREE_PLAN_LIMITS } from '@/utils/types';
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
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.08)',
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
    bgColor: 'rgba(0, 0, 0, 0.06)',
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
    bgColor: 'rgba(228, 64, 95, 0.08)',
    placeholder: 'https://instagram.com/p/... or /reel/...',
    tips: [
      'Posts, Reels, and IGTV with recipe captions work best',
      'Public accounts are required',
      'Detailed captions help extraction',
      'You may need to add details manually',
    ],
  },
  website: {
    name: 'Website',
    icon: 'globe-outline',
    color: '#1A1510',
    bgColor: 'rgba(26, 21, 16, 0.06)',
    placeholder: 'https://example.com/recipe/...',
    tips: [
      'Works best with recipe blogs and cooking websites',
      'Sites with structured recipe data are ideal',
      'You may need to add details for non-recipe pages',
      'Public pages only — paywalled content won\'t work',
    ],
  },
  unknown: {
    name: 'Link',
    icon: 'link',
    color: '#8A8578',
    bgColor: 'rgba(26, 21, 16, 0.06)',
    placeholder: 'Paste a link...',
    tips: [
      'Supported: YouTube, TikTok, Instagram, and recipe websites',
    ],
  },
};

export default function AddRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string; mode?: string; url?: string; autoExtract?: string; shareFail?: string }>();
  const { addRecipe } = useRecipeStore();
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();

  const initialPlatform = (params.platform as SocialPlatform) || 'unknown';

  const initialUrlParam = Array.isArray(params.url) ? params.url[0] : params.url;
  const shouldAutoExtract = params.autoExtract === '1' || params.autoExtract === 'true';
  const shouldShowShareFail = params.shareFail === '1' || params.shareFail === 'true';
  const [url, setUrl] = useState(initialUrlParam ?? '');
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
  const hasAutoExtracted = useRef(false);

  const platformConfig = PLATFORM_CONFIGS[detectedPlatform] || PLATFORM_CONFIGS.unknown;

  useEffect(() => {
    if (url.trim()) {
      const detected = socialService.detectPlatform(url.trim());
      if (detected !== 'unknown') {
        setDetectedPlatform(detected);
      }
    }
  }, [url]);

  useEffect(() => {
    if (stage === 'extracting') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [stage]);

  const handleExtract = async (inputUrl?: string) => {
    const urlValue = inputUrl ?? url ?? '';
    if (typeof urlValue !== 'string') { Alert.alert('Error', 'Please enter a link'); return; }
    const urlToProcess = urlValue.trim();
    if (!urlToProcess) { Alert.alert('Error', 'Please enter a link'); return; }

    const platform = socialService.detectPlatform(urlToProcess);
    if (platform === 'unknown') {
      Alert.alert('Error', 'Please enter a valid URL (YouTube, TikTok, Instagram, or a recipe website)');
      return;
    }

    // Gate check for free users
    const allowed = await checkGate('recipe');
    if (!allowed) return;

    try {
      if (inputUrl) setUrl(urlToProcess);
      setStage('extracting');
      setExtractingProgress(0);
      setErrorMessage('');
      setDetectedPlatform(platform);

      const result = await socialService.extractRecipe(urlToProcess, (progress) => {
        setExtractingProgress(progress.progress);
        setExtractingStage(progress.stage);
      });

      if (result.metadata) {
        setVideoMetadata(result.metadata);
        if (result.metadata.thumbnailUrl) setVideoThumbnail(result.metadata.thumbnailUrl);
      }

      if (result.success && result.recipe) {
        setExtractingProgress(100);
        setExtractedRecipe(result.recipe);
        setSourceUrl(urlToProcess);
        setStage('extracted');
      } else if (result.needsManualInput) {
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

  useEffect(() => {
    if (!initialUrlParam || !shouldAutoExtract || hasAutoExtracted.current) return;
    if (typeof initialUrlParam !== 'string' || !initialUrlParam.trim()) return;
    hasAutoExtracted.current = true;
    handleExtract(initialUrlParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrlParam, shouldAutoExtract]);

  useEffect(() => {
    if (!shouldShowShareFail) return;
    Alert.alert('No Link Found', 'We couldn\'t detect a shareable link. In Instagram, tap "Copy Link" and paste it here.');
  }, [shouldShowShareFail]);

  const handleManualExtract = async () => {
    if (!manualDescription.trim()) { Alert.alert('Error', 'Please enter the recipe description'); return; }

    // Gate check for free users
    const allowed = await checkGate('recipe');
    if (!allowed) return;

    try {
      setStage('extracting');
      setExtractingProgress(30);
      setExtractingStage('Processing your input...');

      const result = await socialService.extractRecipeFromManualInput(
        manualDescription.trim(),
        videoMetadata || undefined,
        (progress) => { setExtractingProgress(progress.progress); setExtractingStage(progress.stage); }
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

    // Gate check for free users
    const allowed = await checkGate('recipe');
    if (!allowed) return;

    try {
      setStage('extracting');
      setExtractingProgress(20);
      setExtractingStage('Analyzing video thumbnail...');

      const result = await socialService.extractRecipeFromVision(
        videoThumbnail, videoMetadata,
        (progress) => { setExtractingProgress(progress.progress); setExtractingStage(progress.stage); }
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
      await useUsageStore.getState().incrementUsage('recipe');
      setIsSaving(false);
      Alert.alert('Success', 'Recipe saved!', [{ text: 'OK', onPress: () => router.back() }]);
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

  const isPremium = useAuthStore((s) => s.user?.is_premium);
  const recipesRemaining = useUsageStore((s) => s.getRecipesRemaining());

  // ── Extracted ──
  if (stage === 'extracted' && extractedRecipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <RecipePreview
          recipe={extractedRecipe}
          onSave={handleSave}
          onEdit={() => {}}
          onDiscard={handleReset}
          isSaving={isSaving}
          usageBanner={!isPremium ? { remaining: recipesRemaining, total: FREE_PLAN_LIMITS.recipes_per_week } : undefined}
        />
      </View>
    );
  }

  // ── Manual Input ──
  if (stage === 'needsManualInput') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={handleReset}>
              <Ionicons name="arrow-back" size={22} color="#1A1510" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Add Details</Text>
            <View style={styles.topSpacer} />
          </View>

          {videoThumbnail ? (
            <View style={styles.thumbRow}>
              <Image source={{ uri: videoThumbnail }} style={styles.thumbImg} />
              <View style={styles.thumbInfo}>
                <Text style={styles.thumbTitle} numberOfLines={2}>{videoMetadata?.title || 'Video'}</Text>
                <Text style={styles.thumbAuthor}>{videoMetadata?.author || platformConfig.name}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#C66E4E" />
            <Text style={styles.infoText}>
              {errorMessage || "We couldn't extract the recipe automatically. Please provide the recipe details below."}
            </Text>
          </View>

          {videoThumbnail && (
            <TouchableOpacity style={styles.visionBtn} onPress={handleTryVision}>
              <Ionicons name="eye-outline" size={18} color="#1A1510" />
              <Text style={styles.visionBtnText}>Try AI Vision Analysis</Text>
            </TouchableOpacity>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Recipe Description</Text>
            <Text style={styles.fieldHint}>Include ingredients, amounts, and cooking steps</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Example: 2 cups flour, 1 cup sugar, 2 eggs. Mix dry ingredients, add eggs, bake at 350F for 30 minutes..."
              value={manualDescription}
              onChangeText={setManualDescription}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholderTextColor="#D5D1CB"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !manualDescription.trim() && styles.primaryBtnDisabled]}
            onPress={handleManualExtract}
            disabled={!manualDescription.trim()}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Extract Recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.textBtn} onPress={handleReset}>
            <Text style={styles.textBtnText}>Start Over</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Extracting ──
  if (stage === 'extracting') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setStage('idle'); handleReset(); }}>
              <Ionicons name="arrow-back" size={22} color="#1A1510" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>New Recipe</Text>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Link</Text>
            <View style={styles.readOnly}>
              <Text style={styles.readOnlyText} numberOfLines={1}>{url}</Text>
              <Ionicons name="link" size={18} color="#B5B0A7" />
            </View>
          </View>

          {/* AI Feedback */}
          <Animated.View style={[styles.aiFeedback, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.thumbContainer}>
              {videoThumbnail ? (
                <Image source={{ uri: videoThumbnail }} style={styles.thumbLarge} />
              ) : (
                <View style={[styles.thumbLarge, styles.thumbPlaceholder]}>
                  <Ionicons name={platformConfig.icon} size={36} color={platformConfig.color} />
                </View>
              )}
              <View style={styles.thumbOverlay} />
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color="#D4AF37" />
                <Text style={styles.aiBadgeText}>AI extracting</Text>
              </View>
            </View>

            <Text style={styles.extractingTitle}>Analyzing recipe...</Text>
            <Text style={styles.extractingSub}>
              Our AI is reading the {detectedPlatform === 'website' ? 'webpage' : `${platformConfig.name} content`} and identifying ingredients.
            </Text>
          </Animated.View>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>{extractingStage}</Text>
              <Text style={styles.progressPct}>{extractingProgress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: `${extractingProgress}%` }]}>
                <Animated.View
                  style={[styles.progressShimmer, {
                    transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 200] }) }],
                  }]}
                />
              </Animated.View>
            </View>
          </View>

          {/* Skeleton */}
          <View style={styles.skeleton}>
            <View style={styles.skelGroup}>
              <View style={styles.skelLabel} />
              <View style={styles.skelTags}>
                <View style={[styles.skelTag, { width: 80 }]} />
                <View style={[styles.skelTag, { width: 112 }]} />
                <View style={[styles.skelTag, { width: 64 }]} />
              </View>
            </View>
            <View style={styles.skelGroup}>
              <View style={styles.skelLabel} />
              <View style={styles.skelStep}>
                <View style={styles.skelCircle} />
                <View style={styles.skelLines}>
                  <View style={styles.skelLine} />
                  <View style={[styles.skelLine, { width: '90%' }]} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Default / Idle ──
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1A1510" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>New Recipe</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.idleHeader}>
          <View style={[styles.platformIcon, { backgroundColor: platformConfig.bgColor }]}>
            <Ionicons name={platformConfig.icon} size={28} color={platformConfig.color} />
          </View>
          <Text style={styles.idleTitle}>Add from {platformConfig.name}</Text>
          <Text style={styles.idleSub}>
            Paste a {detectedPlatform === 'website' ? 'website link' : `${platformConfig.name.toLowerCase()} link`} and we'll extract the recipe automatically.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Link</Text>
          <View style={styles.urlInputWrap}>
            <TextInput
              placeholder={platformConfig.placeholder}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.urlInput}
              placeholderTextColor="#D5D1CB"
            />
            <View style={styles.urlIconWrap}>
              <Ionicons name="link" size={18} color="#B5B0A7" />
            </View>
          </View>

          {url.trim() && detectedPlatform !== 'unknown' && detectedPlatform !== initialPlatform && (
            <View style={styles.detectedBadge}>
              <Ionicons name={PLATFORM_CONFIGS[detectedPlatform].icon} size={13} color={PLATFORM_CONFIGS[detectedPlatform].color} />
              <Text style={styles.detectedText}>Detected: {PLATFORM_CONFIGS[detectedPlatform].name}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !url.trim() && styles.primaryBtnDisabled]}
          onPress={() => handleExtract()}
          disabled={!url.trim()}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Extract Recipe</Text>
        </TouchableOpacity>

        <View style={styles.tips}>
          <Text style={styles.tipsLabel}>Tips for best results</Text>
          {platformConfig.tips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1A1510',
    flex: 1,
    textAlign: 'center',
  },
  topSpacer: {
    width: 42,
  },

  // ── Idle Header ──
  idleHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  platformIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  idleTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#1A1510',
    textAlign: 'center',
    marginBottom: 8,
  },
  idleSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#B5B0A7',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },

  // ── Field Group ──
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#B5B0A7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  fieldHint: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#B5B0A7',
    marginBottom: 8,
  },

  // ── URL Input ──
  urlInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.08)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  urlInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#1A1510',
  },
  urlIconWrap: {
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(26, 21, 16, 0.06)',
  },

  // ── Read Only ──
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 12,
  },
  readOnlyText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#8A8578',
  },

  // ── Detected Badge ──
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  detectedText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8A8578',
  },

  // ── Manual Input ──
  manualInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.08)',
    borderRadius: 14,
    padding: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#1A1510',
    minHeight: 160,
  },

  // ── Primary Button ──
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C66E4E',
    borderRadius: 20,
    height: 52,
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(198, 110, 78, 0.4)',
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── Text Button ──
  textBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  textBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#8A8578',
  },

  // ── Vision Button ──
  visionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  visionBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#1A1510',
  },

  // ── Info Box ──
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(198, 110, 78, 0.06)',
    borderRadius: 14,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#1A1510',
    lineHeight: 20,
  },

  // ── Thumbnail Row ──
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.06)',
    marginBottom: 16,
  },
  thumbImg: {
    width: 72,
    height: 54,
    borderRadius: 10,
  },
  thumbInfo: {
    flex: 1,
  },
  thumbTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#1A1510',
    marginBottom: 3,
  },
  thumbAuthor: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── AI Feedback ──
  aiFeedback: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  thumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    marginBottom: 24,
  },
  thumbLarge: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  aiBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  aiBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#1A1510',
  },
  extractingTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: '#1A1510',
    textAlign: 'center',
    marginBottom: 6,
  },
  extractingSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#B5B0A7',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // ── Progress ──
  progressWrap: {
    marginBottom: 24,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#C66E4E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressPct: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#B5B0A7',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C66E4E',
    borderRadius: 3,
    overflow: 'hidden',
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

  // ── Skeleton ──
  skeleton: {
    gap: 24,
  },
  skelGroup: {
    gap: 12,
  },
  skelLabel: {
    height: 16,
    width: 96,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
    borderRadius: 4,
  },
  skelTags: {
    flexDirection: 'row',
    gap: 8,
  },
  skelTag: {
    height: 28,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 8,
  },
  skelStep: {
    flexDirection: 'row',
    gap: 12,
  },
  skelCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
  },
  skelLines: {
    flex: 1,
    gap: 8,
  },
  skelLine: {
    height: 14,
    width: '100%',
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 4,
  },

  // ── Tips ──
  tips: {
    marginTop: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  tipsLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#B5B0A7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5D1CB',
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8A8578',
    lineHeight: 20,
  },
});
