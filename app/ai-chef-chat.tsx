import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  useColorScheme,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { aiService } from '@/services/ai.service';
import { pantryService } from '@/services/pantry.service';
import { getRecipeImage } from '@/utils/recipePlaceholders';

const COLORS = {
  primary: '#FF4B2B',
  olive: '#606C38',
  charcoal: '#121417',
  backgroundLight: '#FDFDFD',
  backgroundDark: '#1A1210',
};

interface IngredientItem {
  name: string;
  quantity?: string;
  emoji?: string;
  category?: string;
  selected: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recipes?: any[];
}

export default function AiChefChatModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ingredients?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);

  // Parse ingredients passed from scan-detail (with quantities)
  const parsedIngredients: IngredientItem[] = params.ingredients
    ? JSON.parse(params.ingredients).map((i: any) => ({
        name: i.name || i,
        quantity: i.quantity || 'some',
        emoji: i.emoji || '🥘',
        category: i.category,
        selected: true,
      }))
    : [];

  const [ingredients, setIngredients] = useState<IngredientItem[]>(parsedIngredients);
  const [showIngredients, setShowIngredients] = useState(true);

  const getSelectedIngredientsText = () => {
    const selected = ingredients.filter((i) => i.selected);
    if (selected.length === 0) return '';
    return selected
      .map((i) => `${i.quantity} ${i.name}`)
      .join(', ');
  };

  const getSelectedIngredientsForAI = () => {
    return ingredients
      .filter((i) => i.selected)
      .map((i) => `${i.quantity} ${i.name}`);
  };

  const getInitialMessage = () => {
    if (ingredients.length > 0) {
      const ingredientList = ingredients
        .map((i) => `• ${i.emoji} ${i.name} (${i.quantity})`)
        .join('\n');
      return `Hi! I can see you have:\n\n${ingredientList}\n\nYou can toggle items on/off above. What would you like to cook with these ingredients?`;
    }
    return "Hi! I'm your AI Chef assistant. I can see what's in your fridge and suggest recipes based on what you want to cook. Try asking:\n\n• \"I want to cook pasta\"\n• \"What can I make for dinner?\"\n• \"I'm craving something spicy\"";
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: getInitialMessage(),
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const toggleIngredient = (index: number) => {
    setIngredients((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Pass ingredients with quantities to AI
      const ingredientsForAI = getSelectedIngredientsForAI();
      const response = await aiService.chatWithChef(inputText.trim(), ingredientsForAI);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        recipes: response.recipes,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleViewRecipe = async (recipe: any) => {
    let imageUrl = '';
    try {
      const base64 = await aiService.generateRecipeImage(recipe.title);
      imageUrl = `data:image/png;base64,${base64}`;
    } catch {
      imageUrl = getRecipeImage(
        recipe.image_url,
        recipe.title,
        recipe.cuisine_type,
        recipe.ingredients_you_have,
        recipe.food_keywords
      );
    }

    router.push({
      pathname: '/suggested-recipe-detail',
      params: {
        recipe: JSON.stringify(recipe),
        imageUrl,
      },
    });
  };

  const handleClose = () => {
    router.back();
  };

  const selectedCount = ingredients.filter((i) => i.selected).length;

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Ionicons name="restaurant" size={20} color={COLORS.primary} />
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : [
                  styles.assistantBubble,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' },
                ],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: isUser
                  ? '#FFFFFF'
                  : isDark
                  ? '#E5E7EB'
                  : COLORS.charcoal,
              },
            ]}
          >
            {message.content}
          </Text>

          {message.recipes && message.recipes.length > 0 && (
            <View style={styles.recipesContainer}>
              <Text style={styles.recipesHeader}>Suggested Recipes:</Text>
              {message.recipes.map((recipe, index) => {
                const imageUrl = getRecipeImage(
                  recipe.image_url,
                  recipe.title,
                  recipe.cuisine_type,
                  recipe.ingredients_you_have,
                  recipe.food_keywords
                );
                return (
                  <Pressable
                    key={index}
                    style={styles.recipeCard}
                    onPress={() => handleViewRecipe(recipe)}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.recipeImage}
                    />
                    <View style={styles.recipeCardContent}>
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        <View style={styles.recipeMetaRow}>
                          <Ionicons name="time-outline" size={13} color="#64748B" />
                          <Text style={styles.recipeTime}>
                            {recipe.total_time_minutes} min
                          </Text>
                          <View style={styles.recipeMatchBadge}>
                            <Text style={styles.recipeMatchText}>
                              {recipe.match_score}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {isUser && (
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </View>
        )}
      </View>
    );
  };

  const suggestionChips = ingredients.length > 0
    ? [
        "What can I make?",
        "Quick recipe",
        "Something healthy",
        "Comfort food",
      ]
    : [
        "What's in my fridge?",
        "I want pasta",
        "Quick dinner ideas",
        "Healthy breakfast",
      ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>
        <View style={styles.headerRow}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : COLORS.charcoal} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerIcon}>
              <Ionicons name="restaurant" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
                AI Chef
              </Text>
              <Text style={styles.headerSubtitle}>
                {selectedCount} of {ingredients.length} items selected
              </Text>
            </View>
          </View>
          <View style={styles.closeButton} />
        </View>
      </View>

      {/* Ingredients Selection */}
      {ingredients.length > 0 && (
        <View style={[styles.ingredientsSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB' }]}>
          <Pressable
            style={styles.ingredientsHeader}
            onPress={() => setShowIngredients(!showIngredients)}
          >
            <View style={styles.ingredientsHeaderLeft}>
              <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.ingredientsHeaderText, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
                Your Ingredients
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{selectedCount}</Text>
              </View>
            </View>
            <Ionicons
              name={showIngredients ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </Pressable>

          {showIngredients && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ingredientsList}
            >
              {ingredients.map((item, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.ingredientChip,
                    item.selected
                      ? styles.ingredientChipSelected
                      : [styles.ingredientChipUnselected, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }],
                  ]}
                  onPress={() => toggleIngredient(index)}
                >
                  <Text style={styles.ingredientEmoji}>{item.emoji}</Text>
                  <View style={styles.ingredientChipText}>
                    <Text
                      style={[
                        styles.ingredientName,
                        { color: item.selected ? '#FFFFFF' : (isDark ? '#E5E7EB' : COLORS.charcoal) },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.ingredientQuantity,
                        { color: item.selected ? 'rgba(255,255,255,0.8)' : '#9CA3AF' },
                      ]}
                    >
                      {item.quantity}
                    </Text>
                  </View>
                  {item.selected && (
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>AI Chef is thinking...</Text>
          </View>
        )}

        {messages.length === 1 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Try asking:</Text>
            <View style={styles.suggestionsRow}>
              {suggestionChips.map((suggestion, index) => (
                <Pressable
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => {
                    setInputText(suggestion);
                  }}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: isKeyboardVisible ? 12 : insets.bottom + 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
              borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                color: isDark ? '#FFFFFF' : COLORS.charcoal,
              },
            ]}
            placeholder="Ask me anything about recipes..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(156,163,175,0.4)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 75, 43, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  // Ingredients Section
  ingredientsSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ingredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  ingredientsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientsHeaderText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  ingredientsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    marginRight: 8,
  },
  ingredientChipSelected: {
    backgroundColor: COLORS.olive,
  },
  ingredientChipUnselected: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  ingredientEmoji: {
    fontSize: 18,
  },
  ingredientChipText: {
    gap: 1,
  },
  ingredientName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    maxWidth: 80,
  },
  ingredientQuantity: {
    fontSize: 11,
    fontFamily: 'NotoSans_500Medium',
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 75, 43, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    flex: 1,
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    lineHeight: 22,
  },
  recipesContainer: {
    marginTop: 12,
    gap: 8,
  },
  recipesHeader: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 4,
  },
  recipeCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 75, 43, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 43, 0.1)',
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F3F4F6',
  },
  recipeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  recipeInfo: {
    flex: 1,
    gap: 4,
  },
  recipeTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.charcoal,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeTime: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
    marginRight: 6,
  },
  recipeMatchBadge: {
    backgroundColor: COLORS.olive,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recipeMatchText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
  },
  suggestionsContainer: {
    marginTop: 24,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 12,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 75, 43, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 43, 0.2)',
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
