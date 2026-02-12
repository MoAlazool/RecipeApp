// ============================================
// TIKTOK SERVICE - Video Metadata Extraction
// ============================================

import axios from 'axios';

export interface TikTokVideoMetadata {
  success: boolean;
  videoId?: string;
  title?: string;
  description?: string;
  author?: string;
  authorUsername?: string;
  thumbnailUrl?: string;
  hashtags?: string[];
  resolvedUrl?: string;
  error?: string;
}

class TikTokService {

  // ============================================
  // URL PATTERN MATCHING
  // ============================================

  /**
   * Check if URL is a TikTok URL (supports ALL formats)
   */
  isTikTokUrl(url: string): boolean {
    const patterns = [
      // Standard format: tiktok.com/@user/video/123
      /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
      // Short formats
      /vm\.tiktok\.com\/[\w]+/i,
      /vt\.tiktok\.com\/[\w]+/i,
      /tiktok\.com\/t\/[\w]+/i,
      // Direct video format
      /tiktok\.com\/v\/\d+/i,
      // Mobile share format
      /m\.tiktok\.com\/v\/\d+/i,
      // Any tiktok domain with path (catch-all for other formats)
      /(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[\w\/@.-]+/i,
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL is a short/redirect URL that needs resolution
   */
  isShortUrl(url: string): boolean {
    const shortPatterns = [
      /vm\.tiktok\.com\/[\w]+/i,
      /vt\.tiktok\.com\/[\w]+/i,
      /tiktok\.com\/t\/[\w]+/i,
    ];
    return shortPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract video ID from various TikTok URL formats
   */
  extractVideoId(url: string): string | null {
    try {
      // Standard format: tiktok.com/@user/video/1234567890
      const standardMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
      if (standardMatch?.[1]) {
        return standardMatch[1];
      }

      // Direct video format: tiktok.com/v/1234567890
      const directMatch = url.match(/tiktok\.com\/v\/(\d+)/i);
      if (directMatch?.[1]) {
        return directMatch[1];
      }

      // Mobile format: m.tiktok.com/v/1234567890
      const mobileMatch = url.match(/m\.tiktok\.com\/v\/(\d+)/i);
      if (mobileMatch?.[1]) {
        return mobileMatch[1];
      }

      // Short format - return the short code (needs resolution)
      const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([\w]+)/i);
      if (shortMatch?.[1]) {
        return shortMatch[1];
      }

      const tMatch = url.match(/tiktok\.com\/t\/([\w]+)/i);
      if (tMatch?.[1]) {
        return tMatch[1];
      }

      return null;
    } catch (error) {
      console.error('Failed to extract TikTok video ID:', error);
      return null;
    }
  }

  /**
   * Normalize TikTok URL - remove tracking parameters
   */
  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  // ============================================
  // URL RESOLUTION
  // ============================================

  /**
   * Resolve short URL to full URL by following redirects
   */
  async resolveShortUrl(shortUrl: string): Promise<string> {
    try {
      // Follow redirects to get the final URL
      const response = await axios.head(shortUrl, {
        maxRedirects: 5,
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // The final URL after redirects
      const resolvedUrl = response.request?.res?.responseUrl ||
                          response.request?.responseURL ||
                          response.headers?.location;

      if (resolvedUrl && resolvedUrl.includes('tiktok.com')) {
        return this.normalizeUrl(resolvedUrl);
      }

      // Fallback: try GET request
      const getResponse = await axios.get(shortUrl, {
        maxRedirects: 5,
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl = getResponse.request?.res?.responseUrl ||
                       getResponse.request?.responseURL;

      if (finalUrl && finalUrl.includes('tiktok.com')) {
        return this.normalizeUrl(finalUrl);
      }

      return shortUrl;
    } catch (error) {
      console.error('Failed to resolve TikTok short URL:', error);
      // Return original URL if resolution fails
      return shortUrl;
    }
  }

  /**
   * Ensure we have a full URL (resolve if short)
   */
  async getFullUrl(url: string): Promise<string> {
    const normalizedUrl = this.normalizeUrl(url);

    if (this.isShortUrl(normalizedUrl)) {
      console.log('Resolving short TikTok URL:', normalizedUrl);
      const resolved = await this.resolveShortUrl(normalizedUrl);
      console.log('Resolved to:', resolved);
      return resolved;
    }

    return normalizedUrl;
  }

  // ============================================
  // METADATA EXTRACTION
  // ============================================

  /**
   * Get video metadata using oEmbed API (free, official)
   */
  async getVideoMetadata(videoUrl: string): Promise<TikTokVideoMetadata> {
    try {
      // First, resolve short URLs to full URLs
      const fullUrl = await this.getFullUrl(videoUrl);

      // Use TikTok's official oEmbed endpoint
      const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(fullUrl)}`;

      const response = await axios.get(oEmbedUrl, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; EITO/1.0)',
        }
      });

      if (response.data) {
        const data = response.data;

        // Extract hashtags from title
        const hashtags = this.extractHashtags(data.title || '');

        // Extract author username from author_url
        let authorUsername = '';
        if (data.author_url) {
          const authorMatch = data.author_url.match(/tiktok\.com\/@([\w.-]+)/i);
          if (authorMatch?.[1]) {
            authorUsername = authorMatch[1];
          }
        }

        // Extract video ID from the resolved URL
        const videoId = this.extractVideoId(fullUrl);

        return {
          success: true,
          videoId: videoId || undefined,
          title: data.title || '',
          description: data.title || '',
          author: data.author_name || '',
          authorUsername,
          thumbnailUrl: data.thumbnail_url || '',
          hashtags,
          resolvedUrl: fullUrl,
        };
      }

      return {
        success: false,
        error: 'No metadata available for this video',
      };
    } catch (error) {
      console.error('Failed to get TikTok metadata:', error);

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Request timeout - please try again',
          };
        }

        if (error.response?.status === 404) {
          return {
            success: false,
            error: 'Video not found or is private',
          };
        }

        if (error.response?.status === 400) {
          return {
            success: false,
            error: 'Invalid TikTok URL',
          };
        }
      }

      return {
        success: false,
        error: 'Failed to fetch video information. The video may be private or unavailable.',
      };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Extract hashtags from text
   */
  extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u0600-\u06FF]+/g;
    const matches = text.match(hashtagRegex);

    if (!matches) return [];

    return [...new Set(matches.map(tag => tag.toLowerCase()))];
  }

  /**
   * Check if hashtags suggest this is a recipe video
   */
  isLikelyRecipeVideo(hashtags: string[]): boolean {
    const recipeRelatedHashtags = [
      '#recipe', '#recipes', '#cooking', '#cook', '#chef',
      '#foodtiktok', '#food', '#homemade', '#homecooking',
      '#easyrecipe', '#quickrecipe', '#dinner', '#lunch',
      '#breakfast', '#dessert', '#baking', '#meal',
      '#foodie', '#yummy', '#delicious', '#tasty',
      '#recipetiktok', '#cookingtiktok', '#learnontiktok',
      '#howto', '#tutorial', '#diy',
      '#طبخ', '#وصفات', '#اكل', '#مطبخ',
    ];

    return hashtags.some(tag =>
      recipeRelatedHashtags.includes(tag.toLowerCase())
    );
  }

  /**
   * Extract potential recipe hints from hashtags
   */
  getRecipeHintsFromHashtags(hashtags: string[]): {
    cuisineHints: string[];
    dishTypeHints: string[];
    dietaryHints: string[];
  } {
    const cuisinePatterns: Record<string, string[]> = {
      italian: ['#italian', '#pasta', '#pizza', '#risotto'],
      mexican: ['#mexican', '#tacos', '#burrito', '#salsa'],
      asian: ['#asian', '#chinese', '#japanese', '#korean', '#thai', '#vietnamese'],
      indian: ['#indian', '#curry', '#biryani', '#masala'],
      mediterranean: ['#mediterranean', '#greek', '#lebanese', '#turkish'],
      american: ['#american', '#bbq', '#burger', '#comfort'],
      middleeastern: ['#middleeastern', '#arabic', '#persian', '#عربي'],
    };

    const dishTypePatterns: Record<string, string[]> = {
      breakfast: ['#breakfast', '#brunch', '#eggs', '#pancakes'],
      lunch: ['#lunch', '#sandwich', '#salad', '#wrap'],
      dinner: ['#dinner', '#maincourse', '#entree'],
      dessert: ['#dessert', '#sweet', '#cake', '#cookies', '#chocolate'],
      appetizer: ['#appetizer', '#snack', '#starter', '#dip'],
      drink: ['#drink', '#smoothie', '#juice', '#cocktail'],
    };

    const dietaryPatterns: Record<string, string[]> = {
      vegan: ['#vegan', '#plantbased'],
      vegetarian: ['#vegetarian', '#veggie', '#meatless'],
      glutenfree: ['#glutenfree', '#gf', '#celiac'],
      keto: ['#keto', '#lowcarb', '#ketodiet'],
      healthy: ['#healthy', '#healthyfood', '#cleaneating', '#fitness'],
    };

    const lowerHashtags = hashtags.map(h => h.toLowerCase());

    const cuisineHints = Object.entries(cuisinePatterns)
      .filter(([, patterns]) => patterns.some(p => lowerHashtags.includes(p)))
      .map(([cuisine]) => cuisine);

    const dishTypeHints = Object.entries(dishTypePatterns)
      .filter(([, patterns]) => patterns.some(p => lowerHashtags.includes(p)))
      .map(([type]) => type);

    const dietaryHints = Object.entries(dietaryPatterns)
      .filter(([, patterns]) => patterns.some(p => lowerHashtags.includes(p)))
      .map(([diet]) => diet);

    return { cuisineHints, dishTypeHints, dietaryHints };
  }

  /**
   * Generate thumbnail URL variants
   */
  getThumbnailUrl(thumbnailUrl: string, quality: 'original' | 'high' | 'medium' = 'high'): string {
    return thumbnailUrl;
  }
}

// Export singleton instance
export const tiktokService = new TikTokService();

// Export class for testing
export default TikTokService;

// ============================================
// HELPER: Check if URL is TikTok
// ============================================
export const isTikTokUrl = (url: string): boolean => {
  return tiktokService.isTikTokUrl(url);
};

// ============================================
// HELPER: Get TikTok thumbnail
// ============================================
export const getTikTokThumbnail = (thumbnailUrl: string): string => {
  return tiktokService.getThumbnailUrl(thumbnailUrl);
};
