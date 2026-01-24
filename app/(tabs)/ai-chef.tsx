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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { aiService } from '@/services/ai.service';
import { pantryService } from '@/services/pantry.service';
import { getRecipeImage } from '@/utils/recipePlaceholders';
import { FLOATING_NAV } from '@/constants/layout';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';

const COLORS = {
  primary: '#FF4B2B',
  olive: '#606C38',
  charcoal: '#121417',
  backgroundLight: '#FDFDFD',
  backgroundDark: '#1A1210',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recipes?: any[]; // Suggested recipes from AI
}

export default function AiChefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);
  const navBottomPadding = Math.max(insets.bottom - 8, FLOATING_NAV.BASE_BOTTOM_PADDING);
  const inputLift = FLOATING_NAV.BAR_HEIGHT + navBottomPadding + 8;
  const inputAreaSpacing = 12;
  const safeKeyboardOffset = 0;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your AI Chef assistant. I can see what's in your fridge and suggest recipes based on what you want to cook. Try asking:\n\n• \"I want to cook pasta\"\n• \"What can I make for dinner?\"\n• \"I'm craving something spicy\"",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    loadPantryItems();
  }, []);

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

  const loadPantryItems = async () => {
    try {
      const items = await pantryService.getAvailableIngredients();
      setPantryItems(items);
    } catch (error) {
      console.error('Failed to load pantry:', error);
    }
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

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Call AI with user's request and available ingredients
      const response = await aiService.chatWithChef(inputText.trim(), pantryItems);

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

  const handleViewRecipe = (recipe: any) => {
    const imageUrl = getRecipeImage(
      recipe.image_url,
      recipe.title,
      recipe.cuisine_type,
      recipe.ingredients_you_have
    );

    router.push({
      pathname: '/suggested-recipe-detail',
      params: {
        recipe: JSON.stringify(recipe),
        imageUrl,
      },
    });
  };

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

          {/* Render suggested recipes */}
          {message.recipes && message.recipes.length > 0 && (
            <View style={styles.recipesContainer}>
              <Text style={styles.recipesHeader}>Suggested Recipes:</Text>
              {message.recipes.map((recipe, index) => (
                <Pressable
                  key={index}
                  style={styles.recipeCard}
                  onPress={() => handleViewRecipe(recipe)}
                >
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text style={styles.recipeTime}>
                      <Ionicons name="time-outline" size={14} />
                      {' '}{recipe.total_time_minutes} min
                    </Text>
                  </View>
                  <View style={styles.recipeMatchBadge}>
                    <Text style={styles.recipeMatchText}>
                      {recipe.match_score}% match
                    </Text>
                  </View>
                </Pressable>
              ))}
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

  const suggestionChips = [
    "What's in my fridge?",
    "I want pasta",
    "Quick dinner ideas",
    "Healthy breakfast",
  ];

  return (
    <TabScreenTransition style={styles.container}>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight },
        ]}
        edges={['top', 'left', 'right']}
      >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="restaurant" size={24} color={COLORS.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
              AI Chef
            </Text>
            <Text style={styles.headerSubtitle}>
              {pantryItems.length} items in your fridge
            </Text>
          </View>
        </View>
        <Pressable style={styles.refreshButton} onPress={loadPantryItems}>
          <Ionicons name="refresh" size={20} color={isDark ? '#FFFFFF' : COLORS.charcoal} />
        </Pressable>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={[
          styles.messagesContent,
          { paddingBottom: inputAreaSpacing },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>AI Chef is thinking...</Text>
          </View>
        )}

        {/* Suggestion Chips */}
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
                    handleSend();
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
        keyboardVerticalOffset={safeKeyboardOffset}
      >
        <View
          style={[
            styles.inputContainer,
            {
              marginBottom: isKeyboardVisible ? 0 : inputLift,
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
    </SafeAreaView>
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerLeft: {
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
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(255, 75, 43, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 43, 0.1)',
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
  recipeTime: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
  },
  recipeMatchBadge: {
    backgroundColor: COLORS.olive,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recipeMatchText: {
    fontSize: 11,
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
    paddingVertical: 12,
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
