import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@rneui/themed';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import type { Recipe } from '@/utils/types';

const C = {
  gold: '#D4AF37',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
};

const STORY_WIDTH = Dimensions.get('window').width;
const STORY_HEIGHT = (STORY_WIDTH * 16) / 9;

const getDifficultyLabel = (d: string) => {
  switch (d) {
    case 'beginner': return 'Easy';
    case 'intermediate': return 'Medium';
    case 'advanced': return 'Hard';
    default: return d;
  }
};

const formatTime = (minutes?: number) => {
  if (!minutes) return '\u2014';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.round((minutes / 60) * 2) / 2;
  return h % 1 ? `${Math.floor(h)}\u00BDhr` : `${h}hr`;
};

interface InstagramStoryCardProps {
  recipe: Recipe;
  caption: string;
}

export default function InstagramStoryCard({ recipe, caption }: InstagramStoryCardProps) {
  const hasImage = !!recipe.thumbnail_url;

  return (
    <View style={styles.container}>
      {/* Background */}
      {hasImage ? (
        <>
          <ExpoImage
            source={{ uri: recipe.thumbnail_url }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.darkOverlay} />
        </>
      ) : (
        <LinearGradient
          colors={['#2C2420', C.terracotta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Top spacer */}
        <View style={styles.topSpacer} />

        {/* Middle content */}
        <View style={styles.middle}>
          <Text style={styles.recipeLabel}>RECIPE</Text>
          <Text style={styles.title} numberOfLines={3}>{recipe.title}</Text>

          <View style={styles.goldHairline} />

          {/* Stat pills */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{formatTime(recipe.total_time_minutes)}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{getDifficultyLabel(recipe.difficulty)}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{recipe.ingredients.length} items</Text>
            </View>
          </View>

          <View style={styles.goldHairline} />

          <Text style={styles.caption}>{caption}</Text>
        </View>

        {/* Bottom — branded app footer */}
        <View style={styles.bottom}>
          <View style={styles.appCard}>
            <ExpoImage
              source={require('../../assets/icon.png')}
              style={styles.appIcon}
              contentFit="cover"
            />
            <View style={styles.appInfo}>
              <Text style={styles.appName}>EITO</Text>
              <Text style={styles.appTagline}>Save & Cook Any Recipe</Text>
            </View>
            <View style={styles.downloadBadge}>
              <Text style={styles.downloadText}>GET</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    backgroundColor: C.charcoal,
    overflow: 'hidden',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Main content
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  topSpacer: {
    flex: 0.32,
  },
  middle: {
    alignItems: 'center',
  },
  recipeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: C.gold,
    letterSpacing: 4,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 20,
  },
  goldHairline: {
    width: 60,
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.5,
    marginVertical: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  caption: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
  },

  // Bottom branded footer
  bottom: {
    alignItems: 'center',
    paddingBottom: 42,
    paddingHorizontal: 4,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    gap: 12,
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  appTagline: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  downloadBadge: {
    backgroundColor: C.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  downloadText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
