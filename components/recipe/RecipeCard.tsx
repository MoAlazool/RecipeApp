import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { Recipe } from '@/utils/types';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  muted: '#8A8578',
  terracotta: '#B8845C',
};

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  onCook: () => void;
}

export function RecipeCard({ recipe, onPress, onCook }: RecipeCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.thumbnailWrapper}>
        <Image
          source={{ uri: recipe.thumbnail_url }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={300}
        />
      </View>

      <View style={styles.content}>
        {recipe.cuisine_type ? (
          <Text style={styles.cuisine}>{recipe.cuisine_type.toUpperCase()}</Text>
        ) : null}

        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <View style={styles.meta}>
          <Ionicons name="time-outline" size={12} color={C.muted} />
          <Text style={styles.metaText}>
            {recipe.total_time_minutes || 15} min
          </Text>
          {recipe.difficulty ? (
            <>
              <Text style={styles.metaDot}>&middot;</Text>
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cookButton} onPress={onCook} activeOpacity={0.8}>
            <BlurView intensity={40} tint="light" style={styles.cookButtonBlur}>
              <Text style={styles.cookButtonText}>Cook Now</Text>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 14,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.08)',
  },
  thumbnailWrapper: {
    width: 90,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E2D8',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cuisine: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 3,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 19,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },
  metaDot: {
    color: C.muted,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cookButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cookButtonBlur: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
  },
  cookButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.charcoal,
  },
});
