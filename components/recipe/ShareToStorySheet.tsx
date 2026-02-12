import React, { forwardRef, useCallback, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, Linking, Dimensions, Share } from 'react-native';
import { Text } from '@rneui/themed';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import InstagramStoryCard from './InstagramStoryCard';
import type { Recipe } from '@/utils/types';

// Try loading expo-media-library — may not be in native binary yet
let MediaLibrary: typeof import('expo-media-library') | null = null;
try {
  MediaLibrary = require('expo-media-library');
} catch {
  // Native module not available in this build — will fall back to share sheet
}

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  cardBg: '#F5F3EE',
};

// TODO: Replace with your actual App Store URL once published
const APP_STORE_LINK = 'https://apps.apple.com/app/eito';

const SCREEN_WIDTH = Dimensions.get('window').width;
const STORY_HEIGHT = (SCREEN_WIDTH * 16) / 9;
const PREVIEW_SCALE = 0.55;

const CAPTIONS = [
  'Cooking this today! \u{1F373}',
  'I love this recipe! \u{2764}\u{FE0F}',
  'Must try this! \u{1F525}',
  'Weekend cooking \u{1F37D}\u{FE0F}',
  'Made with love \u{1F49B}',
];

interface ShareToStorySheetProps {
  recipe: Recipe;
}

const ShareToStorySheet = forwardRef<BottomSheetModal, ShareToStorySheetProps>(
  ({ recipe }, ref) => {
    const insets = useSafeAreaInsets();
    const viewShotRef = useRef<ViewShot>(null);
    const [selectedCaption, setSelectedCaption] = useState(CAPTIONS[0]);
    const [isSharing, setIsSharing] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const getShareText = useCallback(() => {
      const lines = [
        `\u{1F373} ${recipe.title}`,
        '',
        `Made with EITO \u{2014} save & cook any recipe!`,
        APP_STORE_LINK,
      ];
      return lines.join('\n');
    }, [recipe]);

    const copyLink = useCallback(async () => {
      await Clipboard.setStringAsync(getShareText());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 4000);
    }, [getShareText]);

    // Capture the full-res (off-screen) card
    const captureStoryImage = useCallback(async () => {
      return captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    }, []);

    // PRIMARY: Save to Photos → open Instagram directly
    const handleShareInstagram = useCallback(async () => {
      if (isSharing) return;
      setIsSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const uri = await captureStoryImage();
        await copyLink();

        // Try saving to Photos via expo-media-library
        if (MediaLibrary) {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              await MediaLibrary.createAssetAsync(uri);

              Alert.alert(
                'Story Image Saved!',
                'Image saved to Photos & link copied to clipboard.\n\nIn Instagram Stories, swipe up to pick it from your gallery, then add a link sticker!',
                [
                  {
                    text: 'Open Instagram',
                    onPress: async () => {
                      try {
                        await Linking.openURL('instagram://story-camera');
                      } catch {
                        try { await Linking.openURL('instagram://'); } catch {}
                      }
                    },
                  },
                  { text: 'Later', style: 'cancel' },
                ]
              );
              return;
            }
          } catch {
            // MediaLibrary native module not available — fall through to share sheet
          }
        }

        // Fallback: generic share sheet
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: 'Share your recipe story',
        });
      } catch {
        // User cancelled
      } finally {
        setIsSharing(false);
      }
    }, [isSharing, captureStoryImage, copyLink]);

    // SECONDARY: Share image + text via native share sheet (WhatsApp, Messages, X, etc.)
    const handleShareOther = useCallback(async () => {
      if (isSharing) return;
      setIsSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const uri = await captureStoryImage();
        await Share.share({
          message: getShareText(),
          title: recipe.title,
          url: uri, // iOS: attaches the image alongside the text
        });
      } catch {
        // Capture failed — fall back to text-only
        try {
          await Share.share({
            message: getShareText(),
            title: recipe.title,
          });
        } catch {}
      } finally {
        setIsSharing(false);
      }
    }, [isSharing, captureStoryImage, getShareText, recipe.title]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['85%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      >
        <BottomSheetView style={styles.content}>
          {/* Hidden full-res card for high-quality capture */}
          <View style={styles.hiddenCapture} pointerEvents="none">
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
              <InstagramStoryCard recipe={recipe} caption={selectedCaption} />
            </ViewShot>
          </View>

          {/* Title */}
          <Text style={styles.sheetTitle}>Share Your Creation</Text>

          {/* Visible scaled preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewScaler}>
              <InstagramStoryCard recipe={recipe} caption={selectedCaption} />
            </View>
          </View>

          {/* Caption chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
            style={styles.chipsScroll}
          >
            {CAPTIONS.map((caption) => {
              const isSelected = caption === selectedCaption;
              return (
                <Pressable
                  key={caption}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCaption(caption);
                  }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {caption}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Link copied indicator */}
          {linkCopied && (
            <View style={styles.linkCopiedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.linkCopiedText}>
                Link copied — paste it as a link sticker in your story!
              </Text>
            </View>
          )}

          {/* Share to Instagram button */}
          <Pressable
            style={({ pressed }) => [
              styles.shareBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              isSharing && { opacity: 0.7 },
            ]}
            onPress={handleShareInstagram}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="logo-instagram" size={20} color="#FFF" />
            )}
            <Text style={styles.shareBtnText}>
              {isSharing ? 'Preparing...' : 'Share to Instagram'}
            </Text>
          </Pressable>

          {/* Share to other apps */}
          <Pressable
            style={({ pressed }) => [
              styles.otherShareBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleShareOther}
            disabled={isSharing}
          >
            <Ionicons name="share-outline" size={18} color={C.charcoal} />
            <Text style={styles.otherShareText}>Share to Other Apps</Text>
          </Pressable>

          <View style={{ height: insets.bottom + 8 }} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

ShareToStorySheet.displayName = 'ShareToStorySheet';
export default ShareToStorySheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  hiddenCapture: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 16,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  previewScaler: {
    transform: [{ scale: PREVIEW_SCALE }],
    transformOrigin: 'top center',
    marginBottom: -((1 - PREVIEW_SCALE) * STORY_HEIGHT),
  },
  chipsScroll: {
    marginBottom: 16,
    flexGrow: 0,
  },
  chipsContainer: {
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.cardBg,
  },
  chipSelected: {
    backgroundColor: C.gold,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.charcoal,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  linkCopiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderRadius: 12,
  },
  linkCopiedText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#34C759',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.terracotta,
    paddingVertical: 16,
    borderRadius: 22,
    marginBottom: 10,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  shareBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  otherShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 4,
  },
  otherShareText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.charcoal,
  },
});
