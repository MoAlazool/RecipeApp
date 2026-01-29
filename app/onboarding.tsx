import { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

// Screen 1: Video to Recipe
const VideoToRecipeIllustration = () => {
  const floatY = useSharedValue(0);
  const linkRotate = useSharedValue(0);
  const heartScale = useSharedValue(1);
  const scanLineY = useSharedValue(0);

  useState(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    linkRotate.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    heartScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  });

  const videoCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: '-6deg' },
    ],
  }));

  const recipeCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -floatY.value * 0.8 },
      { rotate: '6deg' },
    ],
  }));

  const linkIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${linkRotate.value}deg` },
    ],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: heartScale.value },
      { rotate: '12deg' },
    ],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    top: interpolate(scanLineY.value, [0, 1], [20, 100], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.illustrationContainer}>
      {/* Phone Mockup */}
      <View style={styles.phoneMockup}>
        <View style={styles.phoneScreen}>
          <View style={styles.phoneContent}>
            <View style={[styles.placeholderBlock, { height: 80, marginBottom: 12 }]} />
            <View style={[styles.placeholderLine, { width: '75%' }]} />
            <View style={[styles.placeholderLine, { width: '50%' }]} />
            <View style={{ paddingTop: 16, gap: 8 }}>
              <View style={styles.placeholderInput} />
              <View style={styles.placeholderInput} />
            </View>
          </View>
        </View>
        <View style={styles.phoneNotch} />
      </View>

      {/* Video Card (Left) */}
      <Animated.View style={[styles.floatingCard, styles.videoCard, videoCardStyle]}>
        <Image
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLxIHCR1lzbt0EFn5jbPHtwewEJeemiQZD3ZMF80uFqGAi8AWHNMq6Lq0hF142p-_XmoH_1-rNgsJ3HSP03yxUF-vVLLeUzI5T_ixOb3YxuEFV2EL-fohn4Mxdd4MrH6dT_5SH9RWtOqcoPmdy0XmkxS-IeL4uN1PDrH6dgF0_ioHzBcrnpGWvrupX9uOW5jyqll_PdbVEZBahHDm8FQvaTkpPOuCnaFDsSvtiKQ2Szr4o6xjnCpCzs5phjdHcHuE-eND-wwOj5uE' }}
          style={styles.videoThumbnail}
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={36} color="#fff" />
        </View>
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
      </Animated.View>

      {/* Recipe Card (Right) */}
      <Animated.View style={[styles.floatingCard, styles.recipeCard, recipeCardStyle]}>
        <View style={styles.recipeCardHeader}>
          <View style={styles.recipeIconCircle}>
            <Ionicons name="restaurant" size={14} color="#F2330D" />
          </View>
          <View style={[styles.placeholderLine, { width: 50, height: 8 }]} />
        </View>
        <View style={styles.recipeIngredients}>
          <View style={styles.ingredientRow}>
            <View style={styles.ingredientCheck} />
            <View style={[styles.placeholderLine, { flex: 1, height: 6 }]} />
          </View>
          <View style={styles.ingredientRow}>
            <View style={styles.ingredientCheck} />
            <View style={[styles.placeholderLine, { flex: 1, height: 6 }]} />
          </View>
        </View>
      </Animated.View>

      {/* Link Icon (Top Right) */}
      <Animated.View style={[styles.iconBubble, styles.linkIcon, linkIconStyle]}>
        <Ionicons name="link" size={20} color="#4A90D9" />
      </Animated.View>

      {/* Heart Icon (Bottom Left) */}
      <Animated.View style={[styles.iconBubble, styles.heartIcon, heartStyle]}>
        <Ionicons name="heart" size={18} color="#E53E3E" />
      </Animated.View>
    </View>
  );
};

// Screen 2: Fridge Scan - Simple image-based illustration matching the design
const FridgeScanIllustration = () => {
  // Pulse animation for tags
  const pulseScale = useSharedValue(1);
  const tag1Float = useSharedValue(0);
  const tag2Float = useSharedValue(0);

  useState(() => {
    // Pulse animation
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Float animation for tags
    tag1Float.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    tag2Float.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(3, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  });

  const tag1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: tag1Float.value }, { rotate: '-6deg' }],
  }));

  const tag2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: tag2Float.value }, { rotate: '2deg' }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.fridgePhotoContainer}>
        {/* Main Card */}
        <View style={styles.fridgePhotoCard}>
          {/* Inner Image Container */}
          <View style={styles.fridgePhotoInner}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1-Pb9J-EMkoplJfdXv12gCdel_wn9mnseUV6S7C78E3Enk6Yb6L_SvJuMNSRe7g4XIniG7oRNSJI6iqUybAnpxTVTgbqGgm2CnQd9kIf28ZhZcpaRGlpKsAVh0ysjXt_dtMsOCY3Pu60UjkRlQuctyyeGMTxuMbep68Zc6KeVNCLqqEQoUiFp2JNxVbcDEBVX71vDXpb5-DmXBSIPoPoZqOn-DOHz0XTWZQT_QCHlS3zJu16QLy68XtRdF0vfgLmdNXXa0td9OXs' }}
              style={styles.fridgePhotoImage}
              resizeMode="cover"
            />

            {/* Gradient Overlay */}
            <View style={styles.fridgePhotoGradient} />

            {/* Corner Brackets */}
            <View style={styles.cornerBrackets}>
              <View style={[styles.cornerBracket, styles.cornerTL]} />
              <View style={[styles.cornerBracket, styles.cornerTR]} />
              <View style={[styles.cornerBracket, styles.cornerBL]} />
              <View style={[styles.cornerBracket, styles.cornerBR]} />
            </View>

            {/* Ingredient Tag - Tomato */}
            <Animated.View style={[styles.ingredientTag, styles.tomatoTag, tag1Style]}>
              <Text style={styles.ingredientEmoji}>🍅</Text>
              <Text style={styles.ingredientLabel}>Tomato</Text>
              <Ionicons name="checkmark-circle" size={16} color="#63e98f" />
            </Animated.View>

            {/* Ingredient Tag - Milk */}
            <Animated.View style={[styles.ingredientTag, styles.milkTag, tag2Style]}>
              <Text style={styles.ingredientEmoji}>🥛</Text>
              <Text style={styles.ingredientLabel}>Milk</Text>
              <Ionicons name="checkmark-circle" size={16} color="#63e98f" />
            </Animated.View>
          </View>
        </View>

        {/* Floating Circle Image */}
        <Animated.View style={[styles.floatingCircleImage, pulseStyle]}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_bmHlqKW7rQHX3C2TQL5iqnFcHAtwzOK-76pDwCTbORarkowNuqrVd1qz_6A2bNN27jKDjuRcMX9w3MafjDT26X9GkrukHUJqSMo_TMOdUKKw0rZDiDd2wp4kSUm-cEZ7nZinPVLm_SvFZbLmajizdWAhnSjvejqCpPR85XBBBxqxI0_3_0f7yYLv_JYHbkwvHcFv6x1uuCnmR9TrA4_wW-HE68_STlJ1NwMtFjiJluiu8hdrjsouoX2KDXhZnHNbZA2GZnQ4UMM' }}
            style={styles.floatingCircleImg}
          />
        </Animated.View>
      </View>
    </View>
  );
};

// Screen 3: Smart Shopping
const SmartShoppingIllustration = () => {
  const checkScale1 = useSharedValue(0);
  const checkScale2 = useSharedValue(0);
  const floatY = useSharedValue(0);

  useState(() => {
    checkScale1.value = withDelay(300, withSpring(1, { damping: 12 }));
    checkScale2.value = withDelay(600, withSpring(1, { damping: 12 }));
    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  });

  const check1Style = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale1.value }],
  }));

  const check2Style = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale2.value }],
  }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <View style={styles.illustrationContainer}>
      {/* Shopping List Card */}
      <View style={styles.shoppingListCard}>
        {/* Checked Item 1 */}
        <View style={[styles.shoppingItem, styles.shoppingItemChecked]}>
          <Animated.View style={check1Style}>
            <Ionicons name="checkmark-circle" size={22} color="#F2330D" />
          </Animated.View>
          <View style={styles.shoppingItemContent}>
            <Text style={styles.shoppingItemTitle}>Yellow Onions</Text>
            <Text style={styles.shoppingItemQty}>2 Units</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>PRODUCE</Text>
          </View>
        </View>

        {/* Checked Item 2 */}
        <View style={[styles.shoppingItem, styles.shoppingItemChecked]}>
          <Animated.View style={check2Style}>
            <Ionicons name="checkmark-circle" size={22} color="#F2330D" />
          </Animated.View>
          <View style={styles.shoppingItemContent}>
            <Text style={styles.shoppingItemTitle}>Ground Beef</Text>
            <Text style={styles.shoppingItemQty}>500g</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: '#FFF3E6' }]}>
            <Text style={[styles.categoryBadgeText, { color: '#E67E22' }]}>MEAT</Text>
          </View>
        </View>

        {/* Unchecked Item */}
        <View style={[styles.shoppingItem, styles.shoppingItemUnchecked]}>
          <View style={styles.uncheckedCircle} />
          <View style={styles.shoppingItemContent}>
            <Text style={[styles.shoppingItemTitle, { opacity: 0.5 }]}>Fresh Thyme</Text>
            <Text style={[styles.shoppingItemQty, { opacity: 0.5 }]}>1 Bunch</Text>
          </View>
        </View>
      </View>

      {/* Floating Ingredients */}
      <Animated.View style={[styles.floatingFoodCircle, { top: 10, right: 30, transform: [{ rotate: '15deg' }] }, floatStyle]}>
        <Image
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLxIHCR1lzbt0EFn5jbPHtwewEJeemiQZD3ZMF80uFqGAi8AWHNMq6Lq0hF142p-_XmoH_1-rNgsJ3HSP03yxUF-vVLLeUzI5T_ixOb3YxuEFV2EL-fohn4Mxdd4MrH6dT_5SH9RWtOqcoPmdy0XmkxS-IeL4uN1PDrH6dgF0_ioHzBcrnpGWvrupX9uOW5jyqll_PdbVEZBahHDm8FQvaTkpPOuCnaFDsSvtiKQ2Szr4o6xjnCpCzs5phjdHcHuE-eND-wwOj5uE' }}
          style={styles.foodCircleImage}
        />
      </Animated.View>

      <Animated.View style={[styles.floatingFoodCircle, { top: 40, left: 10, transform: [{ rotate: '-10deg' }] }, floatStyle]}>
        <Image
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtFdwcXyMPT4DGK7NzSshowg7XXrv5lnaiY-MMUWwbZ5xQy0ShyOHDGAyaw3W1S3_HUHB7UUk45Z11eAKlyV45ZcsHpWaiPakkZ5cbZ-ly11onBgj_Jn6ACzA-f2MUrV7dVoKjYZ343j2vVKyN8MO41QTLSJWtUqetFkjJ1yemkAEETnksIRXdayXPTSTQTYETwdNHfT-51PXKMelJnMSv7cyCocvxrBBh6VYMI1uSDDctzM7BoWJWVocWDyiKRFt7m7rdNOO6YYU' }}
          style={styles.foodCircleImage}
        />
      </Animated.View>

      <Animated.View style={[styles.floatingFoodCircle, { top: 0, left: '40%', width: 50, height: 50 }]}>
        <Image
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8fW529em7mZB3XSneofGjtOlI2TOSEjtgQSWKqkaueCFZm_yitQuRgqoxoeoy7ERlQAejc7YxiFEegIR88EAZ-6Yz-oyViZDGe_FYoLfkd_NH2REfMffm9b8fBPovkcqA1kXpAkRwziImZrYCxniHNWu9vXSx1f7VfmkAIE61CNcPnQPHs19a_jvJlplnxuh70HCahlkEMyQy8BGtLr8VjzK1hzbwvS3xhY1b45nvp8As9kmrv2vdO95QB_ou_BPsVNtIX8zvnKs' }}
          style={styles.foodCircleImage}
        />
      </Animated.View>
    </View>
  );
};

// Screen 4: AI Assistant
const AIAssistantIllustration = () => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const timerRotate = useSharedValue(0);
  const micScale = useSharedValue(1);

  useState(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1000 }),
        withTiming(1, { duration: 0 })
      ),
      -1
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1000 }),
        withTiming(0.4, { duration: 0 })
      ),
      -1
    );
    timerRotate.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    micScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const timerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${timerRotate.value}deg` }],
  }));

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  return (
    <View style={styles.illustrationContainer}>
      {/* Timer Card */}
      <Animated.View style={[styles.timerCard, timerStyle]}>
        <Ionicons name="timer-outline" size={20} color="#F2330D" />
        <Text style={styles.timerText}>08:45</Text>
        <Text style={styles.timerLabel}>SEARING</Text>
      </Animated.View>

      {/* Phone with cooking step */}
      <View style={[styles.phoneMockup, { transform: [{ rotate: '-6deg' }] }]}>
        <View style={styles.phoneScreen}>
          <View style={styles.phoneContent}>
            <View style={styles.stepCard}>
              <Text style={styles.stepLabel}>STEP 1</Text>
              <Text style={styles.stepTitle}>Sear the beef on high heat</Text>
            </View>
            <View style={styles.stepImagePlaceholder}>
              <Ionicons name="restaurant" size={48} color="#E8D3CE" />
            </View>
          </View>
        </View>
        <View style={styles.phoneNotch} />
      </View>

      {/* Mic Button with Pulse */}
      <View style={styles.micContainer}>
        <Animated.View style={[styles.micPulse, pulseStyle]} />
        <Animated.View style={[styles.micButton, micStyle]}>
          <Ionicons name="mic" size={28} color="#1C100D" />
        </Animated.View>
        <View style={styles.listeningLabel}>
          <Text style={styles.listeningText}>LISTENING FOR "NEXT"</Text>
        </View>
      </View>

      {/* Decorative blurs */}
      <View style={[styles.decorBlur, { top: 60, left: 20, backgroundColor: '#E3F2FD' }]} />
      <View style={[styles.decorBlur, { bottom: 80, right: 40, width: 14, height: 14, backgroundColor: '#FFF3E0' }]} />
    </View>
  );
};

// Screen 5: Chat & Share
const ChatShareIllustration = () => {
  const heartScale = useSharedValue(1);
  const chatBubbleY = useSharedValue(0);
  const recipeCardRotate = useSharedValue(0);

  useState(() => {
    heartScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );
    chatBubbleY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    recipeCardRotate.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  });

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }, { rotate: '12deg' }],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chatBubbleY.value }],
  }));

  const recipeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${recipeCardRotate.value}deg` }],
  }));

  return (
    <View style={styles.illustrationContainer}>
      {/* Chat Phone Frame */}
      <View style={styles.chatPhoneFrame}>
        {/* Header */}
        <View style={styles.chatHeader}>
          <View style={styles.avatarStack}>
            <View style={[styles.miniAvatar, { backgroundColor: '#4A90D9' }]} />
            <View style={[styles.miniAvatar, { backgroundColor: '#9B59B6', marginLeft: -8 }]} />
          </View>
          <Text style={styles.chatGroupName}>COOKING SQUAD</Text>
        </View>

        {/* Chat Content */}
        <View style={styles.chatContent}>
          {/* Friend's message */}
          <Animated.View style={[styles.chatBubbleRow, bubbleStyle]}>
            <View style={[styles.miniAvatar, { backgroundColor: '#E3F2FD', width: 20, height: 20 }]} />
            <View style={styles.chatBubbleLeft}>
              <Text style={styles.chatBubbleText}>This looks amazing! Let's cook it tonight?</Text>
            </View>
          </Animated.View>

          {/* Shared Recipe Card */}
          <Animated.View style={[styles.sharedRecipeCard, recipeStyle]}>
            <View style={styles.sharedRecipeImage}>
              <Image
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLxIHCR1lzbt0EFn5jbPHtwewEJeemiQZD3ZMF80uFqGAi8AWHNMq6Lq0hF142p-_XmoH_1-rNgsJ3HSP03yxUF-vVLLeUzI5T_ixOb3YxuEFV2EL-fohn4Mxdd4MrH6dT_5SH9RWtOqcoPmdy0XmkxS-IeL4uN1PDrH6dgF0_ioHzBcrnpGWvrupX9uOW5jyqll_PdbVEZBahHDm8FQvaTkpPOuCnaFDsSvtiKQ2Szr4o6xjnCpCzs5phjdHcHuE-eND-wwOj5uE' }}
                style={styles.sharedRecipeImg}
              />
              <View style={styles.playButtonSmall}>
                <Ionicons name="play-circle" size={24} color="#fff" />
              </View>
            </View>
            <View style={styles.sharedRecipeInfo}>
              <Text style={styles.sharedRecipeTitle}>Summer Garlic Pasta</Text>
              <Text style={styles.sharedRecipeMeta}>15 MINS • EASY</Text>
            </View>
          </Animated.View>

          {/* My response */}
          <View style={styles.chatBubbleRowRight}>
            <View style={styles.chatBubbleRight}>
              <Text style={styles.chatBubbleTextRight}>I'm in! 🍝</Text>
            </View>
            <View style={[styles.miniAvatar, { backgroundColor: '#F2330D', width: 20, height: 20 }]} />
          </View>
        </View>
      </View>

      {/* Floating Icons */}
      <Animated.View style={[styles.floatingIconChat, { top: 80, right: -10 }, heartStyle]}>
        <Ionicons name="heart" size={20} color="#E53E3E" />
      </Animated.View>

      <View style={[styles.floatingIconChat, { bottom: 100, left: -10, transform: [{ rotate: '-12deg' }] }]}>
        <Ionicons name="chatbubble" size={20} color="#4A90D9" />
      </View>

      <View style={styles.floatingAvatarChat}>
        <Image
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtFdwcXyMPT4DGK7NzSshowg7XXrv5lnaiY-MMUWwbZ5xQy0ShyOHDGAyaw3W1S3_HUHB7UUk45Z11eAKlyV45ZcsHpWaiPakkZ5cbZ-ly11onBgj_Jn6ACzA-f2MUrV7dVoKjYZ343j2vVKyN8MO41QTLSJWtUqetFkjJ1yemkAEETnksIRXdayXPTSTQTYETwdNHfT-51PXKMelJnMSv7cyCocvxrBBh6VYMI1uSDDctzM7BoWJWVocWDyiKRFt7m7rdNOO6YYU' }}
          style={styles.floatingAvatarImg}
        />
      </View>
    </View>
  );
};

const SLIDES = [
  {
    id: 'video',
    title: 'Turn Any Video into a Recipe',
    description: 'Paste a link from YouTube, TikTok, or Instagram and get ingredients instantly.',
    Illustration: VideoToRecipeIllustration,
  },
  {
    id: 'fridge',
    title: 'Snap Your Fridge. Cook Smarter.',
    description: 'Take a photo of your ingredients and discover recipes you can make right now.',
    Illustration: FridgeScanIllustration,
  },
  {
    id: 'shopping',
    title: 'Smart Shopping Lists, Done for You',
    description: 'Automatically generate and organize shopping lists from your recipes.',
    Illustration: SmartShoppingIllustration,
  },
  {
    id: 'assistant',
    title: 'Your AI-Powered Cooking Assistant',
    description: 'Hands-free cooking mode with interactive timers and smart guidance.',
    Illustration: AIAssistantIllustration,
  },
  {
    id: 'share',
    title: 'Cook & Share with Friends',
    description: 'Share your favorite video-recipes and plan delicious meals with your cooking group.',
    Illustration: ChatShareIllustration,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);
  const slideProgress = useSharedValue(0);

  const slide = SLIDES[index];
  const canNext = index < SLIDES.length - 1;
  const canBack = index > 0;
  const buttonText = canNext ? 'Continue' : 'Get Started';

  const onNext = useCallback(() => {
    if (canNext) {
      slideProgress.value = withTiming(1, { duration: 300 }, () => {
        runOnJS(setIndex)(index + 1);
        slideProgress.value = 0;
      });
    } else {
      router.replace('/auth?mode=signup');
    }
  }, [canNext, index, router, slideProgress]);

  const onBack = useCallback(() => {
    if (canBack) {
      setIndex(index - 1);
    }
  }, [canBack, index]);

  const onSkip = useCallback(() => {
    router.replace('/auth');
  }, [router]);

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -50 && canNext) {
        runOnJS(setIndex)(index + 1);
      } else if (event.translationX > 50 && canBack) {
        runOnJS(setIndex)(index - 1);
      }
      translateX.value = withSpring(0);
    });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 0.3 }],
    opacity: interpolate(Math.abs(translateX.value), [0, 100], [1, 0.7], Extrapolation.CLAMP),
  }));

  const dots = useMemo(
    () =>
      SLIDES.map((_, dotIndex) => (
        <Animated.View
          key={`dot-${dotIndex}`}
          style={[
            styles.dot,
            dotIndex === index ? styles.dotActive : styles.dotInactive,
          ]}
        />
      )),
    [index]
  );

  const Illustration = slide.Illustration;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {canBack ? (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="chevron-back" size={24} color="#1C100D" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
          <Text style={styles.stepIndicator}>ONBOARDING {index + 1}/{SLIDES.length}</Text>
          <View style={styles.headerRight}>
            {canNext ? (
              <TouchableOpacity onPress={onSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
        </View>

        {/* Content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.content, animatedContentStyle]}>
            {/* Illustration */}
            <Animated.View
              key={slide.id}
              entering={FadeIn.duration(400)}
              style={styles.illustrationWrapper}
            >
              <Illustration />
            </Animated.View>

            {/* Text Content */}
            <Animated.View
              key={`text-${slide.id}`}
              entering={FadeIn.duration(400).delay(100)}
              style={styles.textContent}
            >
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.description}</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.dots}>{dots}</View>

          <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.9}>
            <Text style={styles.buttonText}>{buttonText}</Text>
            {canNext && <Ionicons name="arrow-forward" size={20} color="#1C100D" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>

          <View style={styles.homeIndicator} />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerLeft: {
    width: 40,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  stepIndicator: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    opacity: 0.4,
    letterSpacing: 1,
  },
  skipText: {
    color: '#1C100D',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 14,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapper: {
    width: '100%',
    height: height * 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  illustrationContainer: {
    width: width - 48,
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  subtitle: {
    color: '#9C5749',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    paddingTop: 16,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 10,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#63e98f',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#D1D5DB',
  },
  button: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#63e98f',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#63e98f',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonText: {
    color: '#1C100D',
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  homeIndicator: {
    width: 134,
    height: 5,
    backgroundColor: '#1C100D',
    borderRadius: 3,
    alignSelf: 'center',
    opacity: 0.15,
  },

  // Phone Mockup
  phoneMockup: {
    width: 180,
    height: 280,
    backgroundColor: '#1C100D',
    borderRadius: 32,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 26,
    overflow: 'hidden',
  },
  phoneContent: {
    flex: 1,
    padding: 12,
  },
  phoneNotch: {
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 20,
    backgroundColor: '#1C100D',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  placeholderBlock: {
    backgroundColor: '#F2EEEC',
    borderRadius: 12,
  },
  placeholderLine: {
    height: 10,
    backgroundColor: '#E8D3CE',
    borderRadius: 5,
    marginBottom: 8,
  },
  placeholderInput: {
    height: 32,
    backgroundColor: '#F8F6F5',
    borderRadius: 8,
  },

  // Floating Cards
  floatingCard: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 2,
    borderColor: '#fff',
  },
  videoCard: {
    top: 20,
    left: -10,
    width: 140,
    height: 95,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F2330D',
    shadowColor: '#F2330D',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  recipeCard: {
    top: 50,
    right: -10,
    width: 130,
    padding: 12,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  recipeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeIngredients: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientCheck: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#F2330D',
  },

  // Icon Bubbles
  iconBubble: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  linkIcon: {
    top: 10,
    right: 60,
  },
  heartIcon: {
    bottom: 40,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  // Fridge Photo Scan - Simple image-based design
  fridgePhotoContainer: {
    width: width - 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fridgePhotoCard: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 4 / 5,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  fridgePhotoInner: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
    position: 'relative',
  },
  fridgePhotoImage: {
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  fridgePhotoGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 233, 143, 0.05)',
  },
  cornerBrackets: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  cornerTL: {
    top: 20,
    left: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 20,
    right: 20,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 20,
    left: 20,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 20,
    right: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 8,
  },
  ingredientTag: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tomatoTag: {
    top: '22%',
    left: '12%',
  },
  milkTag: {
    top: '48%',
    left: '25%',
  },
  ingredientEmoji: {
    fontSize: 18,
  },
  ingredientLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  floatingCircleImage: {
    position: 'absolute',
    right: -10,
    top: '45%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    overflow: 'hidden',
    transform: [{ rotate: '12deg' }],
  },
  floatingCircleImg: {
    width: '100%',
    height: '100%',
  },
  // Shopping List
  shoppingListCard: {
    width: width - 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    marginTop: 60,
  },
  shoppingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  shoppingItemChecked: {
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 51, 13, 0.15)',
  },
  shoppingItemUnchecked: {
    backgroundColor: '#F8F6F5',
  },
  shoppingItemContent: {
    flex: 1,
  },
  shoppingItemTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  shoppingItemQty: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  uncheckedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#E8D3CE',
  },
  categoryBadge: {
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
    letterSpacing: 0.5,
  },
  floatingFoodCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    overflow: 'hidden',
  },
  foodCircleImage: {
    width: '100%',
    height: '100%',
  },

  // AI Assistant
  timerCard: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    zIndex: 10,
  },
  timerText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
    marginTop: 4,
  },
  timerLabel: {
    fontSize: 9,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    letterSpacing: 1,
    marginTop: 2,
  },
  stepCard: {
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(242, 51, 13, 0.15)',
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
    letterSpacing: 1,
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    lineHeight: 22,
  },
  stepImagePlaceholder: {
    flex: 1,
    backgroundColor: '#F8F6F5',
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micContainer: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
  },
  micPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2330D',
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningLabel: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  listeningText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9C5749',
    letterSpacing: 1,
  },
  decorBlur: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.6,
  },

  // Chat & Share
  chatPhoneFrame: {
    width: width - 80,
    height: height * 0.38,
    backgroundColor: '#fff',
    borderRadius: 32,
    borderWidth: 5,
    borderColor: '#1C100D',
    overflow: 'hidden',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EEEC',
    marginBottom: 12,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatGroupName: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    letterSpacing: 1,
  },
  chatContent: {
    flex: 1,
    gap: 10,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chatBubbleRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'flex-end',
  },
  chatBubbleLeft: {
    backgroundColor: '#F2EEEC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '70%',
  },
  chatBubbleRight: {
    backgroundColor: 'rgba(242, 51, 13, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  chatBubbleText: {
    fontSize: 11,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
    lineHeight: 16,
  },
  chatBubbleTextRight: {
    fontSize: 11,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  sharedRecipeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginLeft: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#F2EEEC',
  },
  sharedRecipeImage: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F2EEEC',
  },
  sharedRecipeImg: {
    width: '100%',
    height: '100%',
  },
  playButtonSmall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sharedRecipeInfo: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  sharedRecipeTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  sharedRecipeMeta: {
    fontSize: 9,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  floatingIconChat: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  floatingAvatarChat: {
    position: 'absolute',
    right: -5,
    bottom: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  floatingAvatarImg: {
    width: '100%',
    height: '100%',
  },
});
