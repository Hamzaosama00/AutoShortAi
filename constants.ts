// Load Environment Variables (Client Side)
// Note: Sensitive keys like GOOGLE_CLIENT_SECRET are Server-Side only.

// Royalty-free background music URLs (Hosted on simple CDNs or placeholders)
export const BACKGROUND_MUSIC: Record<string, string> = {
  energetic: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3", // Phonk/Upbeat style
  scary: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3", // Dark ambience
  dramatic: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_344db72820.mp3", // Epic build up
  calm: "https://cdn.pixabay.com/download/audio/2022/05/17/audio_370213d2f3.mp3", // Lo-fi
};

export const NICHE_PRESETS = [
  "Motivation & Success",
  "Scary Stories / Horror",
  "Crazy Facts",
  "Business & Finance",
  "AI & Tech News",
  "Life Hacks",
  "Stoicism",
  "History",
];

export const SYSTEM_INSTRUCTION_SCRIPT = `
You are a viral YouTube Shorts scriptwriter. 
Create a highly engaging, fast-paced script (approx 30 seconds spoken).
Strict JSON output only.
Structure:
1. Hook: 3-5 seconds, grab attention immediately.
2. Body: The main value/story.
3. CTA: Call to action (subscribe/like).
4. VisualKeywords: Array of 3-4 specific English keywords to find stock video footage (e.g., "money raining", "scary forest", "crowd cheering").
5. Mood: One of ['energetic', 'scary', 'calm', 'dramatic'].
6. Title: SEO optimized, clickbait style.
7. Description: SEO optimized with hashtags.
8. Tags: Array of 5-10 keywords.
`;

export const CANVAS_WIDTH = 1080 / 2; // Scaled down for preview
export const CANVAS_HEIGHT = 1920 / 2;