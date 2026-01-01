import { ChannelProfile, YouTubeUser } from "../types";

// The backend handles the specific IDs and Secrets now.
// We just interface with the local API proxy.

export const initGoogleAuth = async (callback: (token: string) => void) => {
  // Poll for status on mount
  try {
    const profile = await getChannelProfile();
    if (profile) {
      // We pass a dummy token string because the actual token is in a HttpOnly cookie now
      callback("valid_session_cookie");
    }
  } catch (e) {
    console.log("Not connected to backend/YouTube");
  }
};

export const requestAuth = () => {
  // Redirect browser to Backend Auth URL
  // The backend will redirect to Google, then back to Frontend
  window.location.href = "/api/youtube/auth";
};

export const clearSession = async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  } catch (e) {
    console.error("Logout failed", e);
  }
};

export const getChannelProfile = async (token?: string): Promise<ChannelProfile | null> => {
  try {
    const response = await fetch("/api/user");
    if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error("Backend connection failed");
    }
    
    const data = await response.json();
    if (data.authenticated) {
        return {
            name: data.name,
            picture: data.picture,
            channelId: data.channelId
        };
    }
    return null;
  } catch (error) {
    console.warn("Could not fetch user profile", error);
    return null;
  }
};

export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  title: string,
  description: string,
  tags: string[]
) => {
  // Convert Blob to File
  const file = new File([videoBlob], "video.webm", { type: "video/webm" });
  
  const formData = new FormData();
  formData.append("video", file);
  formData.append("title", title);
  formData.append("description", description);
  formData.append("tags", JSON.stringify(tags));

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.details || "Upload failed via Backend");
  }

  return await response.json();
};