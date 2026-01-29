// ============================================
// YOUTUBE SERVICE - Transcript Extraction
// ============================================

import axios from 'axios';

interface YouTubeTranscriptResponse {
  success: boolean;
  transcript?: string;
  description?: string;
  error?: string;
  metadata?: {
    title: string;
    thumbnail: string;
    duration: number;
  };
}

class YouTubeService {
  
  // ============================================
  // EXTRACT VIDEO ID FROM URL
  // ============================================
  extractVideoId(url: string): string | null {
    try {
      // Handle ALL YouTube URL formats
      const patterns = [
        // Standard watch URL: youtube.com/watch?v=VIDEO_ID
        /(?:youtube\.com\/watch\?v=)([^&\s#]+)/i,
        // Short URL: youtu.be/VIDEO_ID
        /(?:youtu\.be\/)([^&\s?#]+)/i,
        // Embed URL: youtube.com/embed/VIDEO_ID
        /youtube\.com\/embed\/([^&\s?#]+)/i,
        // Old embed URL: youtube.com/v/VIDEO_ID
        /youtube\.com\/v\/([^&\s?#]+)/i,
        // Shorts URL: youtube.com/shorts/VIDEO_ID
        /youtube\.com\/shorts\/([^&\s?#]+)/i,
        // Live URL: youtube.com/live/VIDEO_ID
        /youtube\.com\/live\/([^&\s?#]+)/i,
        // Mobile URL: m.youtube.com/watch?v=VIDEO_ID
        /m\.youtube\.com\/watch\?v=([^&\s#]+)/i,
        // Music URL: music.youtube.com/watch?v=VIDEO_ID
        /music\.youtube\.com\/watch\?v=([^&\s#]+)/i,
        // Attribution link: youtube.com/attribution_link?...v=VIDEO_ID
        /youtube\.com\/attribution_link\?.*v=([^&\s#]+)/i,
        // Watch with feature: youtube.com/watch?feature=...&v=VIDEO_ID
        /youtube\.com\/watch\?.*v=([^&\s#]+)/i,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          // Clean the video ID (remove any trailing characters)
          return match[1].split(/[?&#]/)[0];
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract video ID:', error);
      return null;
    }
  }

  // ============================================
  // GET TRANSCRIPT FROM YOUTUBE
  // ============================================
  async getTranscript(videoUrl: string): Promise<YouTubeTranscriptResponse> {
    const videoId = this.extractVideoId(videoUrl);

    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL'
      };
    }

    // Try self-hosted API first, then fallback to public endpoint
    const apiUrls = [
      process.env.EXPO_PUBLIC_TRANSCRIPT_API_URL,
      'https://youtube-transcript-api.vercel.app/api/transcript'
    ].filter(Boolean) as string[];

    let lastError: string | undefined;

    for (const apiUrl of apiUrls) {
      try {
        const response = await axios.get(apiUrl, {
          params: { videoId },
          timeout: 30000
        });

        // Clean up transcript if available
        const cleanTranscript = response.data.transcript
          ? this.cleanTranscript(response.data.transcript)
          : undefined;

        // Return response with both transcript and description
        if (cleanTranscript || response.data.description) {
          return {
            success: !!cleanTranscript,
            transcript: cleanTranscript,
            description: response.data.description || undefined,
            error: cleanTranscript ? undefined : 'No transcript available for this video',
            metadata: {
              title: response.data.title || '',
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              duration: response.data.duration || 0
            }
          };
        }

        lastError = 'No transcript or description available';
      } catch (error) {
        // Silent fallback to next API
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            lastError = 'Request timeout';
          } else if (error.response?.status === 404) {
            lastError = 'Transcript not available';
          } else {
            lastError = 'API unavailable';
          }
        }
        // Continue to next API URL
      }
    }

    return {
      success: false,
      error: lastError || 'Could not fetch transcript'
    };
  }

  // ============================================
  // CLEAN TRANSCRIPT TEXT
  // ============================================
  private cleanTranscript(transcript: string | any[]): string {
    try {
      let text = '';
      
      // If transcript is array of segments
      if (Array.isArray(transcript)) {
        text = transcript
          .map(segment => {
            if (typeof segment === 'object' && segment.text) {
              return segment.text;
            }
            return segment;
          })
          .join(' ');
      } else {
        text = String(transcript);
      }
      
      // Clean up the text
      text = text
        .replace(/\[Music\]/gi, '')
        .replace(/\[Applause\]/gi, '')
        .replace(/\[Laughter\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return text;
    } catch (error) {
      console.error('Failed to clean transcript:', error);
      return String(transcript);
    }
  }

  // ============================================
  // GET VIDEO METADATA (without transcript)
  // ============================================
  async getVideoMetadata(videoUrl: string): Promise<any> {
    const videoId = this.extractVideoId(videoUrl);

    if (!videoId) {
      return null;
    }

    try {
      // Use oEmbed endpoint (no API key needed)
      const response = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { timeout: 10000 }
      );

      return {
        title: response.data.title,
        author: response.data.author_name,
        thumbnail: response.data.thumbnail_url,
        videoId
      };
    } catch {
      // Return basic metadata with thumbnail
      return {
        videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  // ============================================
  // ALTERNATIVE: Manual Transcript Input
  // ============================================
  validateTranscript(transcript: string): {
    isValid: boolean;
    wordCount: number;
    estimatedMinutes: number;
  } {
    const cleaned = transcript.trim();
    const wordCount = cleaned.split(/\s+/).length;
    const estimatedMinutes = Math.ceil(wordCount / 150); // Average speaking rate
    
    return {
      isValid: wordCount >= 50, // Minimum 50 words for a recipe
      wordCount,
      estimatedMinutes
    };
  }

  // ============================================
  // Get Video Description
  // Note: Direct scraping doesn't work from React Native (401/CORS)
  // This requires the transcript API to be running
  // ============================================
  async getVideoDescription(videoId: string): Promise<{
    description: string | null;
    title: string | null;
  }> {
    // Try to get from transcript API (which can scrape server-side)
    try {
      const transcriptApiUrl =
        process.env.EXPO_PUBLIC_TRANSCRIPT_API_URL ||
        'https://youtube-transcript-api.vercel.app/api/transcript';

      const response = await axios.get(transcriptApiUrl, {
        params: { videoId },
        timeout: 15000,
      });

      return {
        description: response.data?.description || null,
        title: response.data?.title || null,
      };
    } catch {
      // Fallback to oEmbed for at least the title
      try {
        const oembedResponse = await axios.get(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { timeout: 5000 }
        );
        return {
          description: null,
          title: oembedResponse.data?.title || null,
        };
      } catch {
        return { description: null, title: null };
      }
    }
  }

  // ============================================
  // Helper: Decode HTML entities
  // ============================================
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');
  }
}

// Export singleton instance
export const youtubeService = new YouTubeService();

// Export class for testing
export default YouTubeService;

// ============================================
// HELPER: Detect if URL is YouTube
// ============================================
export const isYouTubeUrl = (url: string): boolean => {
  const patterns = [
    /youtube\.com/i,
    /youtu\.be/i,
    /m\.youtube\.com/i,
    /music\.youtube\.com/i,
  ];
  return patterns.some(pattern => pattern.test(url));
};

// ============================================
// HELPER: Get thumbnail from video ID
// ============================================
export const getYouTubeThumbnail = (videoId: string, quality: 'max' | 'high' | 'medium' | 'default' = 'max'): string => {
  const qualityMap = {
    max: 'maxresdefault',
    high: 'hqdefault',
    medium: 'mqdefault',
    default: 'default'
  };
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};
