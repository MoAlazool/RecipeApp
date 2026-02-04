import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@/utils/types';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  onCook: () => void;
}

export function RecipeCard({ recipe, onPress, onCook }: RecipeCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      default:
        return '#888';
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.image, styles.imageStyle]}>
        <Image
          source={{ uri: recipe.thumbnail_url || 'https://via.placeholder.com/400x200' }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.overlay}>
          {recipe.is_favorite && (
            <View style={styles.favoriteIcon}>
              <Ionicons name="heart" size={20} color="#FF6B35" />
            </View>
          )}
          <View style={styles.timeContainer}>
            <Ionicons name="time-outline" size={14} color="#FFF" />
            <Text style={styles.timeText}>{recipe.total_time_minutes} min</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <View
              style={[
                styles.difficultyDot,
                { backgroundColor: getDifficultyColor(recipe.difficulty) },
              ]}
            />
            <Text style={styles.metaText}>{recipe.difficulty}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color="#888" />
            <Text style={styles.metaText}>{recipe.current_servings} servings</Text>
          </View>

          {recipe.times_cooked > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#4CAF50" />
              <Text style={styles.metaText}>Cooked {recipe.times_cooked}x</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title="Cook Now"
            onPress={onCook}
            buttonStyle={styles.cookButton}
            titleStyle={styles.cookButtonTitle}
            icon={<Ionicons name="restaurant" size={16} color="#FFF" style={{ marginRight: 6 }} />}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    height: 160,
    overflow: 'hidden',
  },
  imageStyle: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  overlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  favoriteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cookButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cookButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});
