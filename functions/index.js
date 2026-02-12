const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { Expo } = require("expo-server-sdk");

initializeApp();
const db = getFirestore();
const expo = new Expo();

/**
 * Cloud Function: Send push notification when a new message is created.
 *
 * Triggers on: conversations/{conversationId}/messages/{messageId}
 *
 * For each participant (except the sender):
 *   - Skips if participant has muted the conversation
 *   - Looks up their expo_push_token from the users collection
 *   - Sends a push notification via Expo Push API
 */
exports.onNewMessage = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;

    const { conversation_id, sender_id, content, message_type } = messageData;
    if (!conversation_id || !sender_id) return;

    // Don't send push for system messages
    if (sender_id === "system") return;

    try {
      // Get conversation to find participants
      const convSnap = await db.doc(`conversations/${conversation_id}`).get();
      if (!convSnap.exists) return;
      const conv = convSnap.data();

      const participants = conv.participants || [];
      const participantDetails = conv.participant_details || [];

      // Find sender name
      const senderDetail = participantDetails.find((p) => p.user_id === sender_id);
      const senderName = senderDetail?.full_name || "Someone";

      // Build notification body
      let body = content || "Sent you a message";
      if (message_type === "recipe") {
        body = "Shared a recipe with you";
      } else if (message_type === "meal_plan") {
        body = "Shared a meal plan with you";
      } else if (message_type === "image") {
        body = "Sent a photo";
      }

      // Determine title
      const title = conv.is_group
        ? `${senderName} in ${conv.group_name || "Group"}`
        : senderName;

      // Collect push tokens for all recipients
      const messages = [];

      for (const participantId of participants) {
        // Skip sender
        if (participantId === sender_id) continue;

        // Check if participant has muted this conversation
        const detail = participantDetails.find((p) => p.user_id === participantId);
        if (detail?.is_muted) continue;

        // Look up user's push token
        const userSnap = await db.doc(`users/${participantId}`).get();
        if (!userSnap.exists) continue;

        const userData = userSnap.data();
        const pushToken = userData?.expo_push_token;
        if (!pushToken || !Expo.isExpoPushToken(pushToken)) continue;

        messages.push({
          to: pushToken,
          sound: "default",
          title,
          body,
          data: {
            type: "message",
            conversationId: conversation_id,
          },
        });
      }

      if (messages.length === 0) return;

      // Send in chunks (Expo API limit)
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Error sending push chunk:", error);
        }
      }
    } catch (error) {
      console.error("onNewMessage error:", error);
    }
  }
);
