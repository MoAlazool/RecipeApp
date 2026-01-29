import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messagingService } from '@/services/messaging.service';
import type { Conversation, Message } from '@/utils/types';
import type { Unsubscribe } from 'firebase/firestore';

interface MessagingState {
  // Data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Record<string, Message[]>; // keyed by conversationId
  unreadCount: number;

  // UI State
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  // Subscriptions (not persisted)
  _conversationsUnsubscribe: Unsubscribe | null;
  _messagesUnsubscribe: Unsubscribe | null;

  // Actions - Conversations
  fetchConversations: () => Promise<void>;
  subscribeToConversations: () => void;
  unsubscribeFromConversations: () => void;

  setCurrentConversation: (conversation: Conversation | null) => void;
  getOrCreateConversation: (otherUserId: string) => Promise<Conversation>;
  getConversation: (conversationId: string) => Promise<Conversation | null>;

  // Actions - Messages
  fetchMessages: (conversationId: string) => Promise<void>;
  subscribeToMessages: (conversationId: string) => void;
  unsubscribeFromMessages: () => void;

  sendMessage: (recipientId: string, content: string) => Promise<Message | null>;
  sendMessageToConversation: (conversationId: string, content: string) => Promise<Message | null>;
  sendRecipeMessage: (
    recipientId: string,
    recipeData: { id: string; title: string; thumbnail_url?: string; total_time_minutes?: number; difficulty?: string }
  ) => Promise<Message | null>;

  markAsRead: (conversationId: string) => Promise<void>;

  // Actions - Group Chats
  createGroup: (
    name: string,
    memberIds: string[],
    description?: string,
    avatarUrl?: string
  ) => Promise<Conversation | null>;
  updateGroupInfo: (
    conversationId: string,
    updates: { group_name?: string; group_description?: string; group_avatar_url?: string }
  ) => Promise<void>;
  addGroupMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeGroupMember: (conversationId: string, memberId: string) => Promise<void>;
  leaveGroup: (conversationId: string) => Promise<void>;
  makeGroupAdmin: (conversationId: string, memberId: string) => Promise<void>;

  clearError: () => void;
  clearAll: () => void;
}

export const useMessagingStore = create<MessagingState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      currentConversation: null,
      messages: {},
      unreadCount: 0,
      isLoading: false,
      isLoadingMessages: false,
      error: null,
      _conversationsUnsubscribe: null,
      _messagesUnsubscribe: null,

      // ============================================
      // CONVERSATIONS
      // ============================================
      fetchConversations: async () => {
        try {
          set({ isLoading: true, error: null });
          const conversations = await messagingService.getConversations();

          // Calculate unread count
          const unreadCount = await messagingService.getTotalUnreadCount();

          set({
            conversations,
            unreadCount,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch conversations',
            isLoading: false,
          });
        }
      },

      subscribeToConversations: () => {
        const { _conversationsUnsubscribe } = get();

        // Clean up existing subscription
        if (_conversationsUnsubscribe) {
          _conversationsUnsubscribe();
        }

        const unsubscribe = messagingService.subscribeToConversations((conversations) => {
          // Calculate unread count from conversations
          const userId = messagingService['getCurrentUserId']?.() || null;
          const unreadCount = userId
            ? conversations.reduce((total, conv) => {
                const participant = conv.participant_details.find(p => p.user_id === userId);
                return total + (participant?.unread_count || 0);
              }, 0)
            : 0;

          set({ conversations, unreadCount });
        });

        set({ _conversationsUnsubscribe: unsubscribe });
      },

      unsubscribeFromConversations: () => {
        const { _conversationsUnsubscribe } = get();
        if (_conversationsUnsubscribe) {
          _conversationsUnsubscribe();
          set({ _conversationsUnsubscribe: null });
        }
      },

      setCurrentConversation: (conversation) => {
        set({ currentConversation: conversation });
      },

      getOrCreateConversation: async (otherUserId: string) => {
        try {
          set({ isLoading: true, error: null });
          const conversation = await messagingService.getOrCreateConversation(otherUserId);

          // Update conversations list if this is a new one
          const { conversations } = get();
          const exists = conversations.some(c => c.id === conversation.id);
          if (!exists) {
            set({ conversations: [conversation, ...conversations] });
          }

          set({ currentConversation: conversation, isLoading: false });
          return conversation;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create conversation',
            isLoading: false,
          });
          throw error;
        }
      },

      getConversation: async (conversationId: string) => {
        try {
          return await messagingService.getConversation(conversationId);
        } catch (error: any) {
          console.error('[MessagingStore] Error getting conversation:', error);
          return null;
        }
      },

      // ============================================
      // MESSAGES
      // ============================================
      fetchMessages: async (conversationId: string) => {
        try {
          set({ isLoadingMessages: true, error: null });
          const messages = await messagingService.getMessages(conversationId);

          set((state) => ({
            messages: { ...state.messages, [conversationId]: messages },
            isLoadingMessages: false,
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch messages',
            isLoadingMessages: false,
          });
        }
      },

      subscribeToMessages: (conversationId: string) => {
        const { _messagesUnsubscribe } = get();

        // Clean up existing subscription
        if (_messagesUnsubscribe) {
          _messagesUnsubscribe();
        }

        const unsubscribe = messagingService.subscribeToMessages(conversationId, (messages) => {
          set((state) => ({
            messages: { ...state.messages, [conversationId]: messages },
          }));
        });

        set({ _messagesUnsubscribe: unsubscribe });
      },

      unsubscribeFromMessages: () => {
        const { _messagesUnsubscribe } = get();
        if (_messagesUnsubscribe) {
          _messagesUnsubscribe();
          set({ _messagesUnsubscribe: null });
        }
      },

      sendMessage: async (recipientId: string, content: string) => {
        try {
          set({ error: null });

          // Optimistic update - add message immediately
          const conversationId = messagingService.generateConversationId(
            messagingService['getCurrentUserId']?.() || '',
            recipientId
          );

          const message = await messagingService.sendMessage(recipientId, content);

          // The real-time subscription will update the messages automatically
          // but we return the message for immediate use
          return message;
        } catch (error: any) {
          set({ error: error.message || 'Failed to send message' });
          return null;
        }
      },

      sendMessageToConversation: async (conversationId: string, content: string) => {
        try {
          set({ error: null });
          const message = await messagingService.sendMessageToConversation(conversationId, content);
          return message;
        } catch (error: any) {
          set({ error: error.message || 'Failed to send message' });
          return null;
        }
      },

      sendRecipeMessage: async (recipientId, recipeData) => {
        try {
          set({ error: null });

          const message = await messagingService.sendRecipeMessage(recipientId, {
            id: recipeData.id,
            title: recipeData.title,
            thumbnail_url: recipeData.thumbnail_url,
            total_time_minutes: recipeData.total_time_minutes,
            difficulty: recipeData.difficulty as any,
          });

          return message;
        } catch (error: any) {
          set({ error: error.message || 'Failed to send recipe' });
          return null;
        }
      },

      markAsRead: async (conversationId: string) => {
        try {
          await messagingService.markAsRead(conversationId);

          // Update local unread count
          const { conversations } = get();
          const updatedConversations = conversations.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                participant_details: conv.participant_details.map(p => ({
                  ...p,
                  unread_count: p.user_id === messagingService['getCurrentUserId']?.() ? 0 : p.unread_count,
                })),
              };
            }
            return conv;
          });

          const unreadCount = await messagingService.getTotalUnreadCount();
          set({ conversations: updatedConversations, unreadCount });
        } catch (error: any) {
          console.error('[MessagingStore] Error marking as read:', error);
        }
      },

      // ============================================
      // GROUP CHATS
      // ============================================
      createGroup: async (name, memberIds, description, avatarUrl) => {
        try {
          set({ isLoading: true, error: null });
          const group = await messagingService.createGroupConversation(
            name,
            memberIds,
            description,
            avatarUrl
          );

          // Add to conversations list
          const { conversations } = get();
          set({
            conversations: [group, ...conversations],
            currentConversation: group,
            isLoading: false,
          });

          return group;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create group',
            isLoading: false,
          });
          return null;
        }
      },

      updateGroupInfo: async (conversationId, updates) => {
        try {
          set({ error: null });
          await messagingService.updateGroupInfo(conversationId, updates);

          // Update local state
          const { conversations, currentConversation } = get();
          const updatedConversations = conversations.map(conv => {
            if (conv.id === conversationId) {
              return { ...conv, ...updates };
            }
            return conv;
          });

          set({
            conversations: updatedConversations,
            currentConversation: currentConversation?.id === conversationId
              ? { ...currentConversation, ...updates }
              : currentConversation,
          });
        } catch (error: any) {
          set({ error: error.message || 'Failed to update group' });
          throw error;
        }
      },

      addGroupMembers: async (conversationId, memberIds) => {
        try {
          set({ error: null });
          await messagingService.addGroupMembers(conversationId, memberIds);
          // Real-time subscription will update the conversation
        } catch (error: any) {
          set({ error: error.message || 'Failed to add members' });
          throw error;
        }
      },

      removeGroupMember: async (conversationId, memberId) => {
        try {
          set({ error: null });
          await messagingService.removeGroupMember(conversationId, memberId);
          // Real-time subscription will update the conversation
        } catch (error: any) {
          set({ error: error.message || 'Failed to remove member' });
          throw error;
        }
      },

      leaveGroup: async (conversationId) => {
        try {
          set({ error: null });
          await messagingService.leaveGroup(conversationId);

          // Remove from local conversations
          const { conversations, currentConversation } = get();
          const updatedConversations = conversations.filter(c => c.id !== conversationId);

          set({
            conversations: updatedConversations,
            currentConversation: currentConversation?.id === conversationId
              ? null
              : currentConversation,
          });
        } catch (error: any) {
          set({ error: error.message || 'Failed to leave group' });
          throw error;
        }
      },

      makeGroupAdmin: async (conversationId, memberId) => {
        try {
          set({ error: null });
          await messagingService.makeGroupAdmin(conversationId, memberId);
          // Real-time subscription will update the conversation
        } catch (error: any) {
          set({ error: error.message || 'Failed to make admin' });
          throw error;
        }
      },

      // ============================================
      // UTILITIES
      // ============================================
      clearError: () => set({ error: null }),

      clearAll: () => {
        const { _conversationsUnsubscribe, _messagesUnsubscribe } = get();

        // Clean up subscriptions
        if (_conversationsUnsubscribe) _conversationsUnsubscribe();
        if (_messagesUnsubscribe) _messagesUnsubscribe();

        set({
          conversations: [],
          currentConversation: null,
          messages: {},
          unreadCount: 0,
          isLoading: false,
          isLoadingMessages: false,
          error: null,
          _conversationsUnsubscribe: null,
          _messagesUnsubscribe: null,
        });
      },
    }),
    {
      name: 'messaging-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist essential data
        conversations: state.conversations,
        unreadCount: state.unreadCount,
      }),
    }
  )
);
