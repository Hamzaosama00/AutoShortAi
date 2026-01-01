// Service to fetch free stock footage using Pexels API
// If no API key is provided, it falls back to a set of reliable generic MP4 urls

const PEXELS_BASE_URL = "https://api.pexels.com/videos/search";

// Fallback videos in case API fails or no key
const FALLBACK_VIDEOS = [
  "https://cdn.pixabay.com/vimeo/328940142/neon-21368.mp4?width=720&hash=85e8392131238682057790858e39145695861110", // Neon tunnel
  "https://cdn.pixabay.com/vimeo/382103328/particles-31367.mp4?width=720&hash=ef410651859c76b00b0051e5058721c5b8e96720", // Abstract particles
  "https://cdn.pixabay.com/vimeo/452367154/network-47206.mp4?width=720&hash=d1e2e921d7023158022806307374007604500570", // Tech network
  "https://cdn.pixabay.com/vimeo/518606403/cloud-65778.mp4?width=720&hash=648f322316e6f9d3434676518175787784013063", // Clouds fast
];

export const fetchStockVideos = async (keywords: string[], apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    console.warn("No Pexels API Key provided, using fallback videos.");
    return FALLBACK_VIDEOS;
  }

  const query = keywords.join(" ");
  try {
    const response = await fetch(`${PEXELS_BASE_URL}?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=medium`, {
      headers: {
        Authorization: apiKey
      }
    });

    if (!response.ok) throw new Error("Pexels API Error");

    const data = await response.json();
    
    // Extract video files (prefer HD 720p/1080p link)
    const videos = data.videos.map((vid: any) => {
      const file = vid.video_files.find((f: any) => f.height >= 720 && f.height <= 1280) || vid.video_files[0];
      return file.link;
    });

    if (videos.length === 0) return FALLBACK_VIDEOS;
    return videos;

  } catch (error) {
    console.error("Failed to fetch stock videos", error);
    return FALLBACK_VIDEOS;
  }
};
