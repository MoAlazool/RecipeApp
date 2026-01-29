// ============================================
// SOCIAL SERVICE - Unified Platform Orchestrator
// ============================================

import axios from 'axios';
import { tiktokService, TikTokVideoMetadata } from './tiktok.service';
import { instagramService, InstagramVideoMetadata } from './instagram.service';
import { youtubeService, isYouTubeUrl } from './youtube.service';
import { aiService } from './ai.service';
import type { ExtractedRecipe, RecipeSourceType } from '@/utils/types';

// ============================================
// TYPES
// ============================================

export type SocialPlatform = 'youtube' | 'tiktok' | 'instagram' | 'website' | 'unknown';

export interface SocialVideoMetadata {
  platform: SocialPlatform;
  videoId?: string;
  title?: string;
  description?: string;
  author?: string;
  thumbnailUrl?: string;
  hashtags?: string[];
}

export interface ExtractionResult {
  success: boolean;
  recipe?: ExtractedRecipe;
  metadata?: SocialVideoMetadata;
  extractionMethod?: 'transcript' | 'description' | 'vision' | 'manual';
  error?: string;
  needsManualInput?: boolean;
  insufficientData?: boolean;
}

export interface ExtractionProgress {
  stage: string;
  progress: number;
  platform: SocialPlatform;
}

type ProgressCallback = (progress: ExtractionProgress) => void;

// ============================================
// SOCIAL SERVICE CLASS
// ============================================

class SocialService {

  // ============================================
  // PLATFORM DETECTION
  // ============================================

  /**
   * Detect which platform a URL belongs to
   */
  detectPlatform(url: string): SocialPlatform {
    if (!url || typeof url !== 'string') {
      return 'unknown';
    }

    const trimmedUrl = url.trim();

    if (isYouTubeUrl(trimmedUrl)) {
      return 'youtube';
    }

    if (tiktokService.isTikTokUrl(trimmedUrl)) {
      return 'tiktok';
    }

    if (instagramService.isInstagramUrl(trimmedUrl)) {
      return 'instagram';
    }

    // Generic website URL (any http/https URL not matching a known platform)
    if (/^https?:\/\//i.test(trimmedUrl)) {
      return 'website';
    }

    return 'unknown';
  }

  /**
   * Check if URL is from a supported platform
   */
  isSupportedUrl(url: string): boolean {
    return this.detectPlatform(url) !== 'unknown';
  }

  /**
   * Get platform display name
   */
  getPlatformDisplayName(platform: SocialPlatform): string {
    const names: Record<SocialPlatform, string> = {
      youtube: 'YouTube',
      tiktok: 'TikTok',
      instagram: 'Instagram',
      website: 'Website',
      unknown: 'Unknown',
    };
    return names[platform];
  }

  /**
   * Get source type for database storage
   */
  getSourceType(platform: SocialPlatform): RecipeSourceType {
    if (platform === 'youtube') return 'youtube';
    if (platform === 'tiktok') return 'tiktok';
    if (platform === 'instagram') return 'instagram';
    if (platform === 'website') return 'website';
    return 'manual';
  }

  // ============================================
  // METADATA EXTRACTION
  // ============================================

  /**
   * Get video metadata from any supported platform
   */
  async getVideoMetadata(url: string): Promise<SocialVideoMetadata | null> {
    const platform = this.detectPlatform(url);

    try {
      switch (platform) {
        case 'youtube': {
          const videoId = youtubeService.extractVideoId(url);
          if (!videoId) return null;

          try {
            const metadata = await youtubeService.getVideoMetadata(url);
            return {
              platform: 'youtube',
              videoId,
              title: metadata.title,
              author: metadata.author,
              thumbnailUrl: metadata.thumbnail,
            };
          } catch {
            // Return basic metadata if full fetch fails
            return {
              platform: 'youtube',
              videoId,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            };
          }
        }

        case 'tiktok': {
          const result = await tiktokService.getVideoMetadata(url);
          if (!result.success) return null;

          return {
            platform: 'tiktok',
            videoId: result.videoId,
            title: result.title,
            description: result.description,
            author: result.author,
            thumbnailUrl: result.thumbnailUrl,
            hashtags: result.hashtags,
          };
        }

        case 'instagram': {
          const result = await instagramService.getVideoMetadata(url);
          if (!result.success) {
            // Use basic metadata as fallback
            const basic = instagramService.getBasicMetadataFromUrl(url);
            return {
              platform: 'instagram',
              videoId: basic.mediaId,
            };
          }

          return {
            platform: 'instagram',
            videoId: result.mediaId,
            title: result.title,
            description: result.description,
            author: result.author,
            thumbnailUrl: result.thumbnailUrl,
            hashtags: result.hashtags,
          };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to get metadata for ${platform}:`, error);
      return null;
    }
  }

  // ============================================
  // RECIPE EXTRACTION
  // ============================================

  /**
   * Extract recipe from any supported platform URL
   * Uses 3-tier fallback strategy:
   * 1. Transcript/Description extraction
   * 2. AI Vision analysis (if available)
   * 3. Manual input with AI assist
   */
  async extractRecipe(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<ExtractionResult> {
    const platform = this.detectPlatform(url);

    if (platform === 'unknown') {
      return {
        success: false,
        error: 'Unsupported URL. Please use a YouTube, TikTok, Instagram, or website link.',
      };
    }

    const updateProgress = (stage: string, progress: number) => {
      onProgress?.({ stage, progress, platform });
    };

    try {
      // YouTube uses transcript-based extraction
      if (platform === 'youtube') {
        return await this.extractFromYouTube(url, updateProgress);
      }

      // TikTok and Instagram use description-based extraction
      if (platform === 'tiktok' || platform === 'instagram') {
        return await this.extractFromSocialMedia(url, platform, updateProgress);
      }

      // Website uses scraping + JSON-LD extraction
      if (platform === 'website') {
        return await this.extractFromWebsite(url, updateProgress);
      }

      return {
        success: false,
        error: 'Platform not supported',
      };
    } catch (error: any) {
      console.error(`Recipe extraction failed for ${platform}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to extract recipe',
      };
    }
  }

  /**
   * Extract recipe from YouTube
   * Priority: 1) Description  2) AI Vision  3) Transcript (last resort)
   */
  private async extractFromYouTube(
    url: string,
    updateProgress: (stage: string, progress: number) => void
  ): Promise<ExtractionResult> {
    updateProgress('Connecting to video...', 10);

    const videoId = youtubeService.extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    let description: string | undefined;
    let title: string | undefined;

    // Get video info (description + title) from transcript API
    updateProgress('Fetching video info...', 15);
    const videoInfo = await youtubeService.getVideoDescription(videoId);
    description = videoInfo.description || undefined;
    title = videoInfo.title || undefined;

    const metadata: SocialVideoMetadata = {
      platform: 'youtube',
      videoId,
      title,
      thumbnailUrl,
    };

    // ========== Strategy 1: Description (FIRST PRIORITY) ==========
    if (description) {
      updateProgress('Analyzing recipe from description...', 30);

      try {
        const recipe = await aiService.extractRecipeFromDescription(description, []);

        if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
          updateProgress('Finalizing...', 90);

          return {
            success: true,
            recipe,
            metadata: { ...metadata, description },
            extractionMethod: 'description',
          };
        }
      } catch {
        // Continue to next strategy
      }
    }

    // ========== Strategy 2: AI Vision (analyze thumbnail) ==========
    updateProgress('Analyzing video thumbnail with AI...', 50);

    try {
      const recipe = await aiService.extractRecipeFromVideoFrames([thumbnailUrl], metadata);

      if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
        updateProgress('Finalizing...', 90);

        return {
          success: true,
          recipe,
          metadata,
          extractionMethod: 'vision',
        };
      }
    } catch {
      // Continue to next strategy
    }

    // ========== Strategy 3: Transcript (LAST RESORT) ==========
    updateProgress('Fetching transcript...', 70);

    try {
      const transcriptResult = await youtubeService.getTranscript(url);

      // Update metadata if we got more info
      if (transcriptResult.description && !description) {
        description = transcriptResult.description;
        metadata.description = description;
      }
      if (transcriptResult.metadata?.title && !title) {
        metadata.title = transcriptResult.metadata.title;
      }

      if (transcriptResult.success && transcriptResult.transcript) {
        updateProgress('Analyzing recipe from transcript...', 85);

        const recipe = await aiService.extractRecipeFromTranscript(transcriptResult.transcript);

        if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
          updateProgress('Finalizing...', 90);

          return {
            success: true,
            recipe,
            metadata,
            extractionMethod: 'transcript',
          };
        }
      }

      // If we got description from transcript API but haven't tried it yet
      if (description && !videoInfo.description) {
        updateProgress('Analyzing recipe from description...', 85);

        const recipe = await aiService.extractRecipeFromDescription(description, []);

        if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
          updateProgress('Finalizing...', 90);

          return {
            success: true,
            recipe,
            metadata,
            extractionMethod: 'description',
          };
        }
      }
    } catch {
      // Continue to manual input
    }

    // All strategies failed - request manual input
    return {
      success: false,
      error: 'Could not extract recipe automatically',
      metadata,
      needsManualInput: true,
    };
  }

  /**
   * Extract recipe from TikTok or Instagram using description
   */
  private async extractFromSocialMedia(
    url: string,
    platform: 'tiktok' | 'instagram',
    updateProgress: (stage: string, progress: number) => void
  ): Promise<ExtractionResult> {
    const platformName = this.getPlatformDisplayName(platform);

    updateProgress(`Connecting to ${platformName}...`, 10);

    // Get video metadata
    const metadata = await this.getVideoMetadata(url);

    if (!metadata) {
      return {
        success: false,
        error: `Could not access ${platformName} video. It may be private or unavailable.`,
        needsManualInput: true,
      };
    }

    updateProgress('Analyzing description...', 30);

    // Get description and hashtags
    const description = metadata.description || metadata.title || '';
    const hashtags = metadata.hashtags || [];

    // If absolutely no data available, request manual input
    if (!description && hashtags.length === 0) {
      return {
        success: false,
        metadata,
        error: 'Could not extract any information from this post. Please provide the recipe details manually.',
        needsManualInput: true,
        insufficientData: true,
      };
    }

    updateProgress('Extracting recipe with AI...', 50);

    try {
      // Use AI to extract recipe from description
      const recipe = await aiService.extractRecipeFromDescription(
        description,
        hashtags
      );

      // Validate the extracted recipe
      if (!recipe || !recipe.title || !recipe.ingredients || recipe.ingredients.length === 0) {
        return {
          success: false,
          metadata,
          error: 'Could not extract a complete recipe from the description.',
          needsManualInput: true,
          insufficientData: true,
        };
      }

      updateProgress('Finalizing...', 90);

      return {
        success: true,
        recipe,
        metadata,
        extractionMethod: 'description',
      };
    } catch (error: any) {
      console.error('Description extraction failed:', error);

      // Return with manual input flag
      return {
        success: false,
        metadata,
        error: 'Could not extract recipe automatically. Please provide additional details.',
        needsManualInput: true,
      };
    }
  }

  /**
   * Extract recipe from a website URL using backend scraping
   */
  private async extractFromWebsite(
    url: string,
    updateProgress: (stage: string, progress: number) => void
  ): Promise<ExtractionResult> {
    updateProgress('Fetching webpage...', 10);

    const metadata: SocialVideoMetadata = {
      platform: 'website',
      title: undefined,
      thumbnailUrl: undefined,
    };

    const apiUrl = process.env.EXPO_PUBLIC_TRANSCRIPT_API_URL;

    // The scrape endpoint only exists on self-hosted servers, not the Vercel fallback
    if (!apiUrl) {
      return {
        success: false,
        error: 'Website extraction requires a self-hosted transcript API. Please provide the recipe details manually.',
        needsManualInput: true,
      };
    }

    // Strip trailing /api/transcript if present to get base URL
    const baseUrl = apiUrl.replace(/\/api\/transcript\/?$/, '');
    const scrapeUrl = `${baseUrl}/api/scrape-recipe`;

    let scrapeResult: any;
    try {
      const response = await axios.get(scrapeUrl, {
        params: { url },
        timeout: 20000,
      });
      scrapeResult = response.data;
    } catch (error: any) {
      console.error('Website scrape failed:', error);
      console.error('Attempted URL:', scrapeUrl);

      // Provide helpful error message
      const isNetworkError = error.message?.includes('Network Error');
      const errorMsg = isNetworkError
        ? 'Could not connect to the recipe scraper. Make sure the transcript API server is running.'
        : 'Could not fetch the webpage. Please check the URL and try again.';

      return {
        success: false,
        error: errorMsg,
        needsManualInput: true,
      };
    }

    if (!scrapeResult?.success) {
      return {
        success: false,
        error: scrapeResult?.error || 'Failed to scrape the webpage.',
        needsManualInput: true,
      };
    }

    // Update metadata with scraped info
    metadata.title = scrapeResult.title || undefined;
    metadata.thumbnailUrl = scrapeResult.image_url || undefined;

    updateProgress('Analyzing recipe data...', 40);

    // If JSON-LD recipe data was found, format it into text for AI extraction
    if (scrapeResult.recipe_data) {
      try {
        const recipeText = this.formatJsonLdRecipe(scrapeResult.recipe_data);
        const recipe = await aiService.extractRecipeFromDescription(recipeText, []);

        if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
          // Use image from JSON-LD or og:image
          if (scrapeResult.image_url && !recipe.image_url) {
            recipe.image_url = scrapeResult.image_url;
          }
          updateProgress('Finalizing...', 90);
          return {
            success: true,
            recipe,
            metadata,
            extractionMethod: 'description',
          };
        }
      } catch {
        // Fall through to page text
      }
    }

    // Fallback: use raw page text
    if (scrapeResult.page_text) {
      updateProgress('Extracting recipe from page content...', 60);

      try {
        const recipe = await aiService.extractRecipeFromDescription(scrapeResult.page_text, []);

        if (recipe && recipe.title && recipe.ingredients && recipe.ingredients.length > 0) {
          if (scrapeResult.image_url && !recipe.image_url) {
            recipe.image_url = scrapeResult.image_url;
          }
          updateProgress('Finalizing...', 90);
          return {
            success: true,
            recipe,
            metadata,
            extractionMethod: 'description',
          };
        }
      } catch {
        // Fall through to manual input
      }
    }

    return {
      success: false,
      metadata,
      error: 'Could not extract a recipe from this webpage. Please provide the recipe details manually.',
      needsManualInput: true,
    };
  }

  /**
   * Format JSON-LD recipe structured data into readable text for AI extraction
   */
  private formatJsonLdRecipe(data: any): string {
    const parts: string[] = [];

    if (data.name) parts.push(`Recipe: ${data.name}`);
    if (data.description) parts.push(`Description: ${data.description}`);
    if (data.recipeYield) parts.push(`Servings: ${Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield}`);
    if (data.prepTime) parts.push(`Prep Time: ${data.prepTime}`);
    if (data.cookTime) parts.push(`Cook Time: ${data.cookTime}`);
    if (data.totalTime) parts.push(`Total Time: ${data.totalTime}`);
    if (data.recipeCategory) parts.push(`Category: ${data.recipeCategory}`);
    if (data.recipeCuisine) parts.push(`Cuisine: ${data.recipeCuisine}`);

    if (data.recipeIngredient && Array.isArray(data.recipeIngredient)) {
      parts.push('\nIngredients:');
      data.recipeIngredient.forEach((ing: string) => parts.push(`- ${ing}`));
    }

    if (data.recipeInstructions) {
      parts.push('\nInstructions:');
      if (Array.isArray(data.recipeInstructions)) {
        data.recipeInstructions.forEach((step: any, i: number) => {
          if (typeof step === 'string') {
            parts.push(`${i + 1}. ${step}`);
          } else if (step.text) {
            parts.push(`${i + 1}. ${step.text}`);
          } else if (step.itemListElement) {
            // HowToSection
            if (step.name) parts.push(`\n${step.name}:`);
            step.itemListElement.forEach((sub: any, j: number) => {
              parts.push(`${j + 1}. ${typeof sub === 'string' ? sub : sub.text || ''}`);
            });
          }
        });
      } else if (typeof data.recipeInstructions === 'string') {
        parts.push(data.recipeInstructions);
      }
    }

    if (data.nutrition) {
      parts.push('\nNutrition:');
      if (data.nutrition.calories) parts.push(`Calories: ${data.nutrition.calories}`);
      if (data.nutrition.proteinContent) parts.push(`Protein: ${data.nutrition.proteinContent}`);
      if (data.nutrition.carbohydrateContent) parts.push(`Carbs: ${data.nutrition.carbohydrateContent}`);
      if (data.nutrition.fatContent) parts.push(`Fat: ${data.nutrition.fatContent}`);
    }

    return parts.join('\n');
  }

  /**
   * Extract recipe using vision analysis of video frames/thumbnail
   * This is a fallback when description extraction fails
   */
  async extractRecipeFromVision(
    thumbnailUrl: string,
    metadata?: SocialVideoMetadata,
    onProgress?: ProgressCallback
  ): Promise<ExtractionResult> {
    const platform = metadata?.platform || 'unknown';

    onProgress?.({
      stage: 'Analyzing video thumbnail...',
      progress: 30,
      platform,
    });

    try {
      // Use AI vision to analyze the thumbnail
      const recipe = await aiService.extractRecipeFromVideoFrames(
        [thumbnailUrl],
        metadata
      );

      if (!recipe || !recipe.title) {
        return {
          success: false,
          error: 'Could not identify recipe from video thumbnail.',
          needsManualInput: true,
        };
      }

      onProgress?.({
        stage: 'Finalizing...',
        progress: 90,
        platform,
      });

      return {
        success: true,
        recipe,
        metadata,
        extractionMethod: 'vision',
      };
    } catch (error: any) {
      console.error('Vision extraction failed:', error);
      return {
        success: false,
        error: 'Vision analysis failed. Please provide recipe details manually.',
        needsManualInput: true,
      };
    }
  }

  /**
   * Extract recipe with manual description input
   * User provides the recipe description/ingredients
   */
  async extractRecipeFromManualInput(
    userDescription: string,
    metadata?: SocialVideoMetadata,
    onProgress?: ProgressCallback
  ): Promise<ExtractionResult> {
    const platform = metadata?.platform || 'unknown';

    onProgress?.({
      stage: 'Processing your input...',
      progress: 30,
      platform,
    });

    try {
      const hashtags = metadata?.hashtags || [];

      const recipe = await aiService.extractRecipeFromDescription(
        userDescription,
        hashtags
      );

      if (!recipe || !recipe.title || !recipe.ingredients || recipe.ingredients.length === 0) {
        return {
          success: false,
          error: 'Could not extract a recipe from the provided description. Please include ingredients and cooking steps.',
        };
      }

      onProgress?.({
        stage: 'Finalizing...',
        progress: 90,
        platform,
      });

      return {
        success: true,
        recipe,
        metadata,
        extractionMethod: 'manual',
      };
    } catch (error: any) {
      console.error('Manual input extraction failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to process recipe description.',
      };
    }
  }
}

// Export singleton instance
export const socialService = new SocialService();

// Export class for testing
export default SocialService;
