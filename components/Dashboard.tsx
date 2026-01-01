import React, { useState, useEffect, useRef } from 'react';
import { generateScript, generateVoiceover } from '../services/geminiService';
import { fetchStockVideos } from '../services/stockService';
import { createVideo } from '../services/videoService';
import { initGoogleAuth, requestAuth, getChannelProfile, uploadVideoToYouTube, clearSession } from '../services/youtubeService';
import { AppStatus, LogEntry, YouTubeUser, ShortScript } from '../types';
import { NICHE_PRESETS } from '../constants';
import { Video, Upload, Play, Zap, Youtube, Activity, Film, Settings, LogOut, HelpCircle, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [user, setUser] = useState<YouTubeUser | null>(null);
  const [niche, setNiche] = useState<string>(NICHE_PRESETS[0]);
  const [language, setLanguage] = useState<string>("English");
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [generatedScript, setGeneratedScript] = useState<ShortScript | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pexelsKey, setPexelsKey] = useState<string>("BQ4PySdj1MT2CzZseHvaRUOZmabAqzRyLQ7SrUGCN1gtOwNa7RvNaszD");
  
  // UI States
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), timestamp: new Date(), message, type }]);
  };

  useEffect(() => {
    const savedPexels = localStorage.getItem("pexelsKey");
    if (savedPexels) setPexelsKey(savedPexels);
    
    // Check URL Params for OAuth Status
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const statusParam = urlParams.get('status');
        const errorParam = urlParams.get('error');

        if (statusParam === 'connected') {
            addLog("YouTube Channel Connected Successfully!", 'success');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (errorParam) {
            addLog(`Connection Failed: ${errorParam}`, 'error');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            setShowConfigHelp(true);
        }
    }
    
    // Auto-Connect using Backend Session
    initGoogleAuth(async (token) => {
        if (!token) return;
        try {
            const profile = await getChannelProfile(token);
            if (profile) {
                setUser(profile);
                addLog(`Connected to ${profile.name}`, 'success');
            }
        } catch (e: any) {
             addLog("Session check failed.", 'info');
        }
    });

    return () => {
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pexelsKey", pexelsKey);
  }, [pexelsKey]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (autoMode && status === AppStatus.IDLE) {
      if (!user) {
          addLog("Automation Paused: Connect YouTube channel.", 'error');
          setAutoMode(false);
          return;
      }
      addLog("Automation: Starting in 5s...", 'info');
      autoTimeoutRef.current = setTimeout(handleGenerateAndUpload, 5000);
    }
  }, [autoMode, status, user]);

  const handleConnect = () => requestAuth();
  
  const handleDisconnect = () => {
    clearSession();
    setUser(null);
    addLog("Disconnected.", 'info');
  };

  const handleGenerateAndUpload = async () => {
    if (status !== AppStatus.IDLE) return;
    if (!user) { addLog("Connect YouTube first.", 'error'); return; }
    
    try {
      setStatus(AppStatus.GENERATING_SCRIPT);
      addLog(`Step 1: Generating Script (${niche})...`);
      const script = await generateScript(niche, language);
      setGeneratedScript(script);
      addLog(`Script: "${script.title}"`, 'success');

      setStatus(AppStatus.FETCHING_VIDEOS);
      addLog(`Step 2: Fetching clips for [${script.visualKeywords.join(', ')}]...`);
      const videoUrls = await fetchStockVideos(script.visualKeywords, pexelsKey);
      
      setStatus(AppStatus.GENERATING_VOICEOVER);
      addLog("Step 3: Generating AI Voiceover...");
      const voiceBuffer = await generateVoiceover(`${script.hook} ${script.body} ${script.cta}`);

      setStatus(AppStatus.RENDERING_VIDEO);
      addLog("Step 4: Rendering Final Video...");
      const blob = await createVideo(script, voiceBuffer, videoUrls, (msg) => addLog(msg));
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      setStatus(AppStatus.UPLOADING);
      addLog("Step 5: Uploading to YouTube...");
      await uploadVideoToYouTube(blob, script.title, script.description, script.tags);
      addLog("UPLOAD COMPLETE!", 'success');
      setStatus(AppStatus.COMPLETED);

    } catch (error: any) {
      console.error(error);
      addLog(`Error: ${error.message}`, 'error');
      setStatus(AppStatus.ERROR);
      if (autoMode) setTimeout(() => setStatus(AppStatus.IDLE), 10000);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setGeneratedScript(null);
    setVideoUrl(null);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-inter selection:bg-red-500 selection:text-white">
      
      {/* Configuration Help for OAuth Errors */}
      {showConfigHelp && (
         <div className="mb-8 bg-red-950/40 border border-red-900 rounded-xl p-6 flex flex-col md:flex-row items-start gap-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-top-4 relative shadow-2xl">
             <button 
                onClick={() => setShowConfigHelp(false)} 
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
             >
                ✕
             </button>
             <AlertCircle className="w-10 h-10 text-red-500 shrink-0 mt-1" />
             <div className="space-y-4 w-full">
                 <div>
                    <h3 className="text-xl font-black text-white">Connection Issues?</h3>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">
                        If you are seeing "Access blocked" or "Error 400", your <b>Redirect URI</b> in Google Cloud Console is incorrect.
                    </p>
                 </div>
                 
                 <div className="bg-black/80 p-5 rounded-lg border border-red-900/50 font-mono text-xs text-gray-300 space-y-3">
                    <p className="text-white font-bold border-b border-gray-800 pb-2 mb-2 uppercase tracking-widest text-red-500">Required Configuration</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-gray-500 mb-1">Authorized JavaScript Origins</span>
                            <code className="block w-full bg-red-900/20 text-red-200 p-2 rounded border border-red-900/50">
                                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                            </code>
                        </div>
                        <div>
                            <span className="block text-gray-500 mb-1">Authorized Redirect URIs</span>
                            <code className="block w-full bg-red-900/20 text-red-200 p-2 rounded border border-red-900/50">
                                http://localhost:3000/api/youtube/callback
                            </code>
                        </div>
                    </div>
                 </div>
             </div>
         </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-10 max-w-6xl mx-auto gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-red-600 to-red-900 p-2 rounded-lg shadow-lg shadow-red-900/40">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">AutoShorts<span className="text-red-600">.AI</span></h1>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">V6.0 BACKEND</span>
                {status !== AppStatus.IDLE && status !== AppStatus.ERROR && status !== AppStatus.COMPLETED && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> BUSY
                    </span>
                )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setShowConfigHelp(!showConfigHelp)}
                className="text-gray-500 hover:text-white transition p-2 hover:bg-gray-800 rounded-full"
                title="Troubleshoot Connection"
            >
                <HelpCircle className="w-5 h-5" />
            </button>

          {!user ? (
            <button 
              onClick={handleConnect}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition active:scale-95 text-sm"
            >
              <Youtube className="w-5 h-5 text-red-600" />
              Connect Channel
            </button>
          ) : (
             <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-full pl-2 pr-4 py-1.5">
                <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full border border-gray-700" />
                <div className="flex flex-col">
                    <span className="text-sm font-bold leading-none">{user.name}</span>
                    <span className="text-[10px] text-green-500">Connected</span>
                </div>
                <button onClick={handleDisconnect} className="ml-2 text-gray-600 hover:text-red-500 transition">
                    <LogOut className="w-4 h-4" />
                </button>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Control Panel */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-6 text-gray-400 uppercase text-xs font-bold tracking-widest">
                <Settings className="w-4 h-4" /> Generator Config
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Content Niche</label>
                <select 
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  disabled={status !== AppStatus.IDLE && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR}
                  className="w-full bg-black border border-gray-800 text-white rounded-lg px-4 py-3 focus:border-red-600 outline-none transition appearance-none"
                >
                  {NICHE_PRESETS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">Language</label>
                    <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={status !== AppStatus.IDLE && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR}
                    className="w-full bg-black border border-gray-800 text-white rounded-lg px-4 py-3 focus:border-red-600 outline-none"
                    >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    </select>
                </div>
                <div>
                     <label className="text-xs font-semibold text-gray-500 mb-2 block">API Key (Pexels)</label>
                     <input 
                       type="password"
                       value={pexelsKey}
                       onChange={(e) => setPexelsKey(e.target.value)}
                       className="w-full bg-black border border-gray-800 text-white rounded-lg px-4 py-3 focus:border-red-600 outline-none placeholder:text-gray-700"
                       placeholder="Optional..."
                     />
                </div>
              </div>

              <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-gray-800 mt-4">
                <div>
                    <span className="text-white font-bold text-sm block">Auto-Pilot Mode</span>
                    <span className="text-xs text-gray-500">Continuously generate & upload</span>
                </div>
                <button 
                  onClick={() => setAutoMode(!autoMode)}
                  disabled={!user}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${autoMode ? 'bg-red-600' : 'bg-gray-800'} ${!user ? 'opacity-50' : ''}`}
                >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${autoMode ? 'translate-x-6' : ''}`}></div>
                </button>
              </div>

              <button
                onClick={status === AppStatus.COMPLETED || status === AppStatus.ERROR ? handleReset : handleGenerateAndUpload}
                disabled={(status !== AppStatus.IDLE && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR) || autoMode}
                className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg mt-4
                  ${(status === AppStatus.IDLE || status === AppStatus.COMPLETED || status === AppStatus.ERROR) && !autoMode
                    ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              >
                {status === AppStatus.IDLE || status === AppStatus.ERROR ? (
                    <>RUN GENERATOR <Zap className="w-5 h-5 fill-current text-red-600" /></>
                ) : status === AppStatus.COMPLETED ? (
                    <>CREATE NEW <Upload className="w-5 h-5" /></>
                ) : (
                    <><Activity className="w-5 h-5 animate-spin" /> PROCESSING...</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-black border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col h-[320px] font-mono text-xs">
            <div className="flex justify-between items-center mb-4 border-b border-gray-900 pb-2">
                <span className="text-gray-500 font-bold uppercase">System Logs</span>
                <span className="text-gray-700">Live Stream</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
              {logs.length === 0 && <span className="text-gray-800 italic">Waiting for start command...</span>}
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-gray-600">[{log.timestamp.toLocaleTimeString([],{hour12:false,minute:'2-digit',second:'2-digit'})}]</span>
                  <span className={`${log.type === 'error' ? 'text-red-500 font-bold' : log.type === 'success' ? 'text-green-500' : 'text-gray-400'}`}>
                    {log.type === 'success' && '✓ '} {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Script Viewer */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-gray-400 uppercase text-xs font-bold tracking-widest">
                    <Film className="w-4 h-4" /> Script Preview
                </div>
                
                {generatedScript ? (
                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
                        <div>
                            <span className="text-[10px] text-red-500 font-bold uppercase mb-1 block">Title</span>
                            <h3 className="text-xl font-bold leading-tight">{generatedScript.title}</h3>
                        </div>
                        <div className="bg-black/40 p-3 rounded-lg border border-gray-800">
                             <span className="text-[10px] text-blue-500 font-bold uppercase mb-1 block">Hook (0-5s)</span>
                             <p className="text-sm text-gray-300 font-medium">"{generatedScript.hook}"</p>
                        </div>
                         <div className="pl-3 border-l-2 border-gray-800">
                             <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Body</span>
                             <p className="text-sm text-gray-400 leading-relaxed">{generatedScript.body}</p>
                        </div>
                        <div>
                             <span className="text-[10px] text-purple-500 font-bold uppercase mb-2 block">Keywords</span>
                             <div className="flex flex-wrap gap-2">
                                {generatedScript.visualKeywords.map(k => (
                                    <span key={k} className="px-2 py-1 bg-gray-800 text-gray-300 text-[10px] rounded border border-gray-700">#{k}</span>
                                ))}
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-800">
                        <Film className="w-12 h-12 mb-2 opacity-20" />
                        <p>No script generated yet</p>
                    </div>
                )}
            </div>

            {/* Video Player */}
            <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl shadow-black ring-1 ring-white/10 group max-h-[600px]">
                    {videoUrl ? (
                        <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition">
                                <Play className="w-6 h-6 text-gray-600 fill-current" />
                            </div>
                            <span className="text-xs text-gray-600 font-bold tracking-widest uppercase">Preview Output</span>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {(status === AppStatus.RENDERING_VIDEO || status === AppStatus.FETCHING_VIDEOS) && (
                        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                             <div className="w-12 h-12 border-4 border-gray-800 border-t-red-600 rounded-full animate-spin mb-4"></div>
                             <span className="text-[10px] font-bold tracking-widest text-red-500 animate-pulse">
                                {status === AppStatus.FETCHING_VIDEOS ? "CURATING CLIPS" : "RENDERING PIXELS"}
                             </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};