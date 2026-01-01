import { CANVAS_WIDTH, CANVAS_HEIGHT, BACKGROUND_MUSIC } from "../constants";
import { ShortScript, CaptionWord } from "../types";

// Helper to decode raw PCM from Gemini
const decodePCM = (
  buffer: ArrayBuffer,
  ctx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer => {
  const byteLength = buffer.byteLength;
  const adjBuffer = byteLength % 2 === 0 ? buffer : buffer.slice(0, byteLength - 1);
  const pcmData = new Int16Array(adjBuffer);
  const audioBuffer = ctx.createBuffer(1, pcmData.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  
  for (let i = 0; i < pcmData.length; i++) {
    channelData[i] = pcmData[i] / 32768.0;
  }
  return audioBuffer;
};

// Easing function for "Pop In" text effect (Elastic Out)
const easeOutElastic = (x: number): number => {
  const c4 = (2 * Math.PI) / 3;
  return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

const generateTimedCaptions = (fullText: string, totalDurationSeconds: number): CaptionWord[] => {
  const rawWords = fullText.replace(/\n/g, " ").split(" ").filter(w => w.trim().length > 0);
  if (rawWords.length === 0) return [];

  const wordsWithWeights = rawWords.map(word => {
    // Unicode support for Hindi/Global languages
    const cleanWord = word.replace(/[^\p{L}\p{N}]/gu, "");
    let weight = 1 + (cleanWord.length * 0.15); 
    
    if (word.includes(",")) weight += 2;
    if (word.includes(".") || word.includes("!") || word.includes("?") || word.includes("।")) weight += 3;
    
    return { word, weight };
  });

  const totalWeight = wordsWithWeights.reduce((sum, item) => sum + item.weight, 0);
  const timePerWeightUnit = totalDurationSeconds / totalWeight;

  let currentTime = 0;
  return wordsWithWeights.map((item) => {
    const duration = item.weight * timePerWeightUnit;
    const caption: CaptionWord = {
      text: item.word,
      startTime: currentTime,
      endTime: currentTime + duration
    };
    currentTime += duration;
    return caption;
  });
};

/**
 * Draws a video frame with "Ken Burns" effect (Pan & Zoom)
 */
const drawKenBurns = (
    ctx: CanvasRenderingContext2D, 
    video: HTMLVideoElement, 
    progress: number, 
    seed: number
) => {
    if (video.readyState < 2) return;

    // Deterministic random based on seed for consistent movement per clip
    const random = (offset: number) => Math.sin(seed + offset) * 10000 % 1;
    
    // Randomize movement direction based on clip index (seed)
    const zoomDirection = random(1) > 0.5 ? 1 : -1; // 1 = Zoom In, -1 = Zoom Out
    const panXDir = random(2) > 0.5 ? 1 : -1;
    const panYDir = random(3) > 0.5 ? 1 : -1;

    // Calculate Scale
    // Base scale is cover + 25% to allow movement without black bars
    const baseScale = Math.max(CANVAS_WIDTH / video.videoWidth, CANVAS_HEIGHT / video.videoHeight) * 1.25;
    const maxZoom = 0.10; // 10% movement
    
    // Linear interpolation for zoom
    let currentScale = baseScale + (zoomDirection === 1 
        ? (progress * baseScale * maxZoom) 
        : (baseScale * maxZoom) - (progress * baseScale * maxZoom));

    // Calculate Position
    const width = video.videoWidth * currentScale;
    const height = video.videoHeight * currentScale;
    
    // Center point
    let x = (CANVAS_WIDTH - width) / 2;
    let y = (CANVAS_HEIGHT - height) / 2;

    // Apply Pan
    const maxPanX = (width - CANVAS_WIDTH) * 0.4; 
    const maxPanY = (height - CANVAS_HEIGHT) * 0.4;

    x += (progress * maxPanX * panXDir);
    y += (progress * maxPanY * panYDir);

    ctx.drawImage(video, x, y, width, height);
};

export const createVideo = async (
  script: ShortScript,
  voiceBuffer: ArrayBuffer,
  videoUrls: string[],
  onProgress: (msg: string) => void
): Promise<Blob> => {
  
  // 1. Setup Audio
  onProgress("Analyzing Voiceover...");
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const voiceAudioBuffer = decodePCM(voiceBuffer, audioCtx, 24000);
  const totalVideoDuration = voiceAudioBuffer.duration;

  if (!totalVideoDuration) throw new Error("Voice generation failed. Zero duration.");

  // 2. Generate Captions
  const fullText = `${script.hook} ${script.body} ${script.cta}`;
  const captions = generateTimedCaptions(fullText, totalVideoDuration);

  // 3. Setup Canvas
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas context failed");

  // 4. Background Music
  let musicAudioBuffer: AudioBuffer | null = null;
  try {
    const musicUrl = BACKGROUND_MUSIC[script.mood] || BACKGROUND_MUSIC['energetic'];
    const musicResp = await fetch(musicUrl);
    if (musicResp.ok) {
      const musicArrayBuffer = await musicResp.arrayBuffer();
      musicAudioBuffer = await audioCtx.decodeAudioData(musicArrayBuffer);
    }
  } catch (e) {
    console.warn("No music loaded");
  }

  // 5. Audio Graph
  const dest = audioCtx.createMediaStreamDestination();
  const voiceSource = audioCtx.createBufferSource();
  voiceSource.buffer = voiceAudioBuffer;
  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = 1.0; 
  voiceSource.connect(voiceGain).connect(dest);

  let musicSource: AudioBufferSourceNode | null = null;
  if (musicAudioBuffer) {
    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = musicAudioBuffer;
    musicSource.loop = true;
    const musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.15; 
    musicSource.connect(musicGain).connect(dest);
  }

  // 6. Preload Videos
  onProgress("Buffering Video Clips...");
  const videoElements: HTMLVideoElement[] = [];
  
  for (const url of videoUrls) {
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.src = url;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = "auto"; 
    await new Promise((resolve) => {
      vid.oncanplay = resolve;
      vid.onerror = () => resolve(null);
      setTimeout(resolve, 3000); 
    });
    if (vid.readyState >= 2) videoElements.push(vid);
  }
  
  if (videoElements.length === 0) throw new Error("Failed to load background footage.");

  // 7. Recorder Setup
  const stream = canvas.captureStream(30);
  stream.addTrack(dest.stream.getAudioTracks()[0]);
  const recorder = new MediaRecorder(stream, { 
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 5000000 // 5 Mbps high quality
  });
  
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      audioCtx.close();
      const finalBlob = new Blob(chunks, { type: "video/webm" });
      resolve(finalBlob);
    };

    recorder.start();
    voiceSource.start(0);
    if (musicSource) musicSource.start(0);
    
    videoElements.forEach(v => {
        v.currentTime = 0;
        v.play().catch(() => {});
    });

    const startTime = performance.now();
    
    // Timing Logic - FAST PACED
    const CLIP_DURATION = 3.0; // 3 Seconds per clip for fast retention
    const TRANSITION_DURATION = 0.5; // Quick transitions

    const drawFrame = () => {
      const now = performance.now();
      const timeSinceStart = (now - startTime) / 1000;

      if (timeSinceStart >= totalVideoDuration + 1.0) { // Add 1s buffer at end
        recorder.stop();
        videoElements.forEach(v => v.pause());
        return;
      }

      // -- VIDEO COMPOSITING ENGINE --
      
      const totalClipCycle = videoElements.length * CLIP_DURATION;
      const normalizedTime = timeSinceStart % totalClipCycle;
      const currentClipIndex = Math.floor(normalizedTime / CLIP_DURATION) % videoElements.length;
      const nextClipIndex = (currentClipIndex + 1) % videoElements.length;

      const clipTime = normalizedTime % CLIP_DURATION;
      const inTransition = clipTime > (CLIP_DURATION - TRANSITION_DURATION);
      
      const currentVideo = videoElements[currentClipIndex];
      const nextVideo = videoElements[nextClipIndex];

      const clipProgress = clipTime / CLIP_DURATION;
      
      // Determine Transition Type (Cycle through 3 types)
      // 0: Slide Up
      // 1: Slide Left
      // 2: Cross Zoom
      const transitionType = nextClipIndex % 3;

      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0, canvas.width, canvas.height);

      // Draw Base Layer
      drawKenBurns(ctx, currentVideo, clipProgress, currentClipIndex);

      // Draw Transition Layer
      if (inTransition) {
        const transitionProgress = (clipTime - (CLIP_DURATION - TRANSITION_DURATION)) / TRANSITION_DURATION;
        const eased = transitionProgress * transitionProgress * (3 - 2 * transitionProgress); // Smoothstep

        ctx.save();
        
        if (transitionType === 0) {
            // SLIDE UP (TikTok Style)
            const offset = CANVAS_HEIGHT * (1 - eased);
            ctx.translate(0, offset);
            ctx.globalAlpha = 1.0;
            drawKenBurns(ctx, nextVideo, 0, nextClipIndex);
        } 
        else if (transitionType === 1) {
            // SLIDE LEFT (Swipe)
            const offset = CANVAS_WIDTH * (1 - eased);
            ctx.translate(offset, 0);
            ctx.globalAlpha = 1.0;
            drawKenBurns(ctx, nextVideo, 0, nextClipIndex);
        } 
        else {
            // CROSS ZOOM (Fade + Scale In)
            ctx.globalAlpha = eased;
            // Scale from 0.8 to 1.0
            const scale = 0.85 + (0.15 * eased);
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            drawKenBurns(ctx, nextVideo, 0, nextClipIndex);
        }
        
        ctx.restore();
      }

      // -- OVERLAY --
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, "rgba(0,0,0,0.1)");
      gradient.addColorStop(0.5, "rgba(0,0,0,0.2)");
      gradient.addColorStop(0.8, "rgba(0,0,0,0.6)");
      gradient.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // -- KINETIC TEXT ANIMATION --
      const activeCaption = captions.find(c => timeSinceStart >= c.startTime && timeSinceStart <= c.endTime);
      
      if (activeCaption) {
        const text = activeCaption.text.trim().toUpperCase();
        
        const wordDuration = activeCaption.endTime - activeCaption.startTime;
        const wordProgress = (timeSinceStart - activeCaption.startTime) / wordDuration;
        
        // Elastic Pop In
        const scale = easeOutElastic(Math.min(wordProgress * 2.5, 1)); 
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);

        // Add Wobble/Rotation for energy
        const wobble = Math.sin(timeSinceStart * 3) * 3 * (Math.PI / 180); // +/- 3 degrees
        ctx.rotate(wobble);

        const rawText = text.replace(/[^a-zA-Z]/g, '');
        const isViral = ['SUBSCRIBE', 'LIKE', 'WARNING', 'STOP', 'MONEY', 'SECRET', 'FACT', 'CRAZY', 'WTF'].includes(rawText) || 
                       ['सब्सक्राइब', 'लाइक', 'पैसा', 'सच'].includes(text);

        ctx.font = "900 72px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 15;
        ctx.lineJoin = "round";

        if (isViral) {
            // Intense Shake
            const shake = Math.sin(timeSinceStart * 40) * 8;
            ctx.rotate(shake * Math.PI / 180);
            
            ctx.strokeStyle = "#000";
            ctx.strokeText(text, 0, 0);
            
            ctx.fillStyle = "#FF0033"; // Bright Red
            ctx.fillText(text, 0, 0);
            
            // Glitch layer
            ctx.fillStyle = "rgba(0,255,255,0.5)";
            ctx.fillText(text, -4, 0);
        } 
        else if (['YOU', 'I', 'WE', 'THEY'].includes(rawText)) {
            // Highlight Keywords
            ctx.strokeStyle = "#000";
            ctx.strokeText(text, 0, 0);
            ctx.fillStyle = "#00F0FF"; // Cyan
            ctx.fillText(text, 0, 0);
        } 
        else {
            // Standard
            ctx.strokeStyle = "rgba(0,0,0,0.8)";
            ctx.strokeText(text, 0, 0);
            ctx.fillStyle = "#FFF";
            ctx.fillText(text, 0, 0);
        }
        
        ctx.restore();
      }

      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
};