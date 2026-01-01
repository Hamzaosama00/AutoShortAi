import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ShortScript } from "../types";
import { SYSTEM_INSTRUCTION_SCRIPT } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateScript = async (niche: string, language: string = "English"): Promise<ShortScript> => {
  try {
    const model = "gemini-2.5-flash";
    
    // Explicitly instruct the model about the language requirements
    const prompt = `Create a viral YouTube Short script for the niche: "${niche}" in ${language}.
    
    CRITICAL INSTRUCTIONS:
    1. The 'hook', 'body', 'cta', 'title', and 'description' fields MUST be in ${language}.
    2. The 'visualKeywords' array MUST be in English (these are used for stock video search).
    3. The 'topic' and 'mood' fields MUST be in English.
    4. Ensure the script is fast-paced and engaging.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_SCRIPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            hook: { type: Type.STRING },
            body: { type: Type.STRING },
            cta: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            mood: { type: Type.STRING, enum: ['energetic', 'scary', 'calm', 'dramatic'] }
          },
          required: ["topic", "title", "description", "hook", "body", "cta", "visualKeywords", "tags", "mood"],
        },
      },
    });

    if (!response.text) throw new Error("No response from AI");
    
    return JSON.parse(response.text) as ShortScript;
  } catch (error) {
    console.error("Gemini Script Error:", error);
    throw error;
  }
};

export const generateVoiceover = async (text: string): Promise<ArrayBuffer> => {
  try {
    // Using Gemini 2.5 TTS for high quality human-like audio
    // It auto-detects language, so passing Hindi text works automatically
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is usually deep/engaging
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};