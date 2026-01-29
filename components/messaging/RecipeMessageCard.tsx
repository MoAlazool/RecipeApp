import React from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { SharedRecipeData } from '@/utils/types';

interface RecipeMessageCardProps {
  recipe: SharedRecipeData;
  onPress?: () => void;
  isCompact?: boolean;
}

const getDifficultyConfig = (difficulty?: string) => {
  switch (difficulty) {
    case 'beginner':
      return { label: 'Easy', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)' };
    case 'intermediate':
      return { label: 'Medium', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
    case 'advanced':
      return { label: 'Hard', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
    default:
      return null;
  }
};

export const RecipeMessageCard: React.FC<RecipeMessageCardProps> = ({
  recipe,
  onPress,
  isCompact = false,
}) => {
  const difficultyConfig = getDifficultyConfig(recipe.difficulty);

  if (isCompact) {
    // Compact horizontal layout for lists
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactContainer,
          pressed && styles.containerPressed,
        ]}
        onPress={onPress}
      >
        {recipe.thumbnail_url ? (
          <Image
            source={{ uri: recipe.thumbnail_url }}
            style={styles.compactImage}
          />
        ) : (
          <View style={styles.compactImagePlaceholder}>
            <Ionicons name="restaurant" size={20} color="#E8D3CE" />
          </View>
        )}

        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Ionicons name="restaurant" size={10} color="#F2330D" />
            <Text style={styles.compactLabel}>Recipe</Text>
          </View>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.total_time_minutes && (
            <View style={styles.compactMeta}>
              <Ionicons name="time-outline" size={10} color="#9C5749" />
              <Text style={styles.compactMetaText}>{recipe.total_time_minutes} min</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
      </Pressable>
    );
  }

  // Full card layout
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      {/* Recipe Image with Overlay */}
      <View style={styles.imageContainer}>
        {recipe.thumbnail_url ? (
          <Image
            source={{ uri: recipe.thumbnail_url }}
            style={styles.image}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant" size={32} color="#E8D3CE" />
          </View>
        )}
        {/* Gradient Overlay */}
        <View style={styles.imageOverlay} />

        {/* Recipe Badge */}
        <View style={styles.recipeBadge}>
          <Ionicons name="restaurant" size={10} color="#FFFFFF" />
          <Text style={styles.recipeBadgeText}>Recipe</Text>
        </View>

        {/* Time Badge on Image */}
        {recipe.total_time_minutes && (
          <View style={styles.timeBadge}>
            <Ionicons name="time" size={12} color="#FFFFFF" />
            <Text style={styles.timeBadgeText}>
              {recipe.total_time_minutes} min
            </Text>
          </View>
        )}
      </View>

      {/* Recipe Info */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <View style={styles.meta}>
          {difficultyConfig && (
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyConfig.bg }]}>
              <View style={[styles.difficultyDot, { backgroundColor: difficultyConfig.color }]} />
              <Text style={[styles.difficultyText, { color: difficultyConfig.color }]}>
                {difficultyConfig.label}
              </Text>
            </View>
          )}
        </View>

        {/* Tap to View */}
        <View style={styles.action}>
          <Text style={styles.actionText}>Tap to view recipe</Text>
          <View style={styles.actionIcon}>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    width: 240,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  containerPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    position: 'relative',
    height: 130,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2EEEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  recipeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2330D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recipeBadgeText: {
    fontSize: 10,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  timeBadgeText: {
    fontSize: 11,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    lineHeight: 20,
    marginBottom: 10,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: 'NotoSans_600SemiBold',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  compactImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
  },
  compactImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F2EEEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 3,
  },
  compactLabel: {
    fontSize: 9,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compactTitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    lineHeight: 17,
    marginBottom: 2,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactMetaText: {
    fontSize: 10,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
  },
});

export default RecipeMessageCard;
