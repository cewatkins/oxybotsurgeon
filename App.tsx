import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Activity, 
  Mic, 
  MicOff, 
  Send, 
  Skull, 
  Power,
  Volume2,
  Dna,
  AudioLines,
  Youtube,
  ChevronRight,
  Maximize2,
  X,
  Loader2,
  Share2,
  Copy,
  Check,
  Search,
  Zap,
  FlaskConical,
  ExternalLink,
  ClipboardList,
  Stethoscope,
  RefreshCcw,
  ShieldCheck,
  FileText
} from 'lucide-react';
import VitalsMonitor from './components/VitalsMonitor';
import ControlKnob from './components/ControlKnob';
import { OXY_SYSTEM_PROMPT, MODELS, VOICE_OPTIONS, VideoMetaData } from './constants';
import { Message, VitalsData, Modality } from './types';
import { 
  decode, 
  encode, 
  decodeAudioData, 
  createPcmBlob 
} from './services/audioUtils';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [vitals, setVitals] = useState<VitalsData[]>([]);
  const [activeCase, setActiveCase] = useState<VideoMetaData | null>(null);
  const [showFullTranscription, setShowFullTranscription] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoMetaData[]>([]);
  const [knobValues, setKnobValues] = useState({ sedation: 0.7, voltage: 0.9 });

  const nextStartTimeRef = useRef(0);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const initAudio = () => {
    if (!inputAudioCtxRef.current) inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
    if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(prev => {
        const last = prev[prev.length - 1] || { heartRate: 72, oxygen: 98 };
        const newData: VitalsData = {
          time: Date.now(),
          heartRate: last.heartRate + (Math.random() * 4 - 2),
          oxygen: Math.min(100, Math.max(94, last.oxygen + (Math.random() * 2 - 1))),
          sedation: knobValues.sedation
        };
        return [...prev.slice(-19), newData];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [knobValues.sedation]);

  // Use backend for latest video
  const syncLatestChannelContent = async () => {
    setIsSyncing(true);
    setSyncLog(`ACCESSING YOUTUBE.COM/@OXYOSBOURNE...\nBYPASSING FIREWALLS...\nEXTRACTING LATEST SURGICAL DATA...`);
    try {
      const resp = await fetch('http://localhost:8000/videos');
      const videos: VideoMetaData[] = await resp.json();
      if (videos.length > 0) {
        const newCase = videos[0];
        setActiveCase(newCase);
        setSyncLog(`LATEST CASE SYNCED: ${newCase.title}\nNEURAL LINK STABLE.`);
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `[NEURAL SYNC COMPLETE]\nDATA POINT: ${newCase.title}\n"The archives are fresh, patient! I can smell the digital copper. STAT!"`,
          timestamp: Date.now()
        }]);
      } else {
        setSyncLog('No videos found in archive.');
      }
    } catch (err) {
      setSyncLog(`CRITICAL ERROR: Sync failed.\nREASON: ${err instanceof Error ? err.message : 'Unknown circuit failure'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Use backend for archive search
  const fetchRealMetadata = async (query: string) => {
    setIsSyncing(true);
    setSyncLog(`PROBING ARCHIVES FOR: ${query}...\nREAL-TIME EXTRACTION IN PROGRESS...`);
    try {
      const resp = await fetch(`http://localhost:8000/videos?query=${encodeURIComponent(query)}`);
      const results: VideoMetaData[] = await resp.json();
      setSearchResults(results.slice(0, 5));
      setSyncLog(`SEARCH COMPLETE. FOUND ${results.length} DATA POINTS.`);
    } catch (err) {
      setSyncLog(`SEARCH ERROR: ${err instanceof Error ? err.message : 'Unknown circuit failure'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchBackendVideos = async (query?: string) => {
    const url = query ? `/videos?query=${encodeURIComponent(query)}` : '/videos';
    const resp = await fetch(`http://localhost:8000${url}`);
    return await resp.json();
  };

  const fetchBackendRandomVideo = async () => {
    const resp = await fetch('http://localhost:8000/random_video');
    return await resp.json();
  };

  const fetchBackendVideo = async (id: string) => {
    const resp = await fetch(`http://localhost:8000/video/${id}`);
    return await resp.json();
  };

  const handleSelectCase = (video: VideoMetaData) => {
    setActiveCase(video);
    setSearchResults([]);
    setSearchQuery('');
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: `[DATA LOADED] SOURCE: ${video.url}\n"This case file is logged. Proceeding with surgical precision!"`,
      timestamp: Date.now()
    }]);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: userMsg.content,
        config: {
          systemInstruction: OXY_SYSTEM_PROMPT + (activeCase ? `\n\nCURRENTLY LOADED REAL DATA:\nTitle: ${activeCase.title}\nURL: ${activeCase.url}\nUse ONLY this real metadata for channel references.` : ''),
          tools: [{ googleSearch: {} }],
          temperature: knobValues.sedation,
        }
      });
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "Static in the line...",
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
    }
  };

  const connectLive = async () => {
    try {
      initAudio();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: MODELS.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice as any } } },
          systemInstruction: OXY_SYSTEM_PROMPT + (activeCase ? `\n\nREAL DATA LOADED: ${activeCase.title}. DO NOT FABRICATE CHANNEL CONTENT.` : ''),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsLive(true);
            setIsRecording(true);
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const pcmBlob = createPcmBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (msg) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const outCtx = outputAudioCtxRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }
            if (msg.serverContent?.outputTranscription) {
              setTranscription(prev => prev + msg.serverContent!.outputTranscription!.text);
            }
            if (msg.serverContent?.turnComplete) setTranscription('');
          },
          onclose: () => setIsLive(false),
          onerror: (e) => console.error(e)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
    }
  };

  const disconnectLive = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    setIsLive(false);
    setTranscription('');
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] p-4 text-slate-300 gap-4 overflow-hidden relative">
      
      {/* Full Surgical Report Modal */}
      {showFullTranscription && activeCase && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-900 border-2 border-emerald-500/50 rounded-lg shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest font-['Orbitron'] text-emerald-400">Archival Verification: {activeCase.id}</h2>
              </div>
              <button onClick={() => setShowFullTranscription(false)} className="p-1 hover:bg-slate-800 rounded transition-colors">
                <X className="w-5 h-5 text-slate-500 hover:text-white" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto font-mono text-sm leading-relaxed text-slate-300">
              <div className="mb-6 p-4 bg-black/40 border border-slate-800 rounded relative">
                <ShieldCheck className="absolute top-2 right-2 w-4 h-4 text-emerald-500 opacity-50" />
                <h3 className="text-emerald-500 font-bold mb-2 uppercase text-[10px]">VERIFIED CHANNEL CONTENT</h3>
                <p className="text-lg font-bold text-white font-['Orbitron'] mb-2">{activeCase.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase">
                  <Youtube className="w-3 h-3 text-red-500" /> @oxyosbourne
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-emerald-500 font-bold uppercase text-[10px] flex items-center gap-2">
                  <Dna className="w-3 h-3" /> Grounding Data Summary
                </h3>
                <p className="whitespace-pre-wrap text-slate-400 leading-relaxed">{activeCase.transcription}</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-black/40 flex justify-end gap-3">
              <button 
                onClick={() => setShowFullTranscription(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded text-xs font-bold uppercase transition-colors"
              >
                Return to Console
              </button>
              <a 
                href={activeCase.url} 
                target="_blank" 
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold uppercase flex items-center gap-2"
              >
                <Youtube className="w-3 h-3" /> View on YouTube
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Surgical Monitor (Left) */}
      <div className="w-1/4 flex flex-col gap-4">
        <div className="vintage-panel border border-slate-700 p-4 rounded-lg flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <h1 className="text-xl font-bold font-['Orbitron'] text-emerald-500 flex items-center gap-2 glow-green">
              <Skull className="w-6 h-6" /> DR. OXY
            </h1>
            <p className="text-[9px] uppercase text-slate-500 font-bold tracking-tighter">SURGICAL OPERATING SYSTEM</p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#4ade80]' : 'bg-red-500 shadow-red-500/50 shadow-md'}`} />
        </div>

        <div className="vintage-panel border border-slate-700 p-3 rounded-lg flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Activity className="w-4 h-4 text-emerald-500" /> Patient Vitals
          </div>
          <VitalsMonitor data={vitals} />
          
          <div className="mt-auto space-y-2 pt-4 border-t border-slate-800/50">
             <button 
              onClick={syncLatestChannelContent}
              disabled={isSyncing}
              className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/50 rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-emerald-400 disabled:opacity-50 group"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />}
              Neural Sync Latest Case
            </button>
          </div>
        </div>

        {/* Neural Link Audio / Transcription Area */}
        <div className="vintage-panel border border-slate-700 p-3 rounded-lg h-32 flex flex-col">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Volume2 className="w-4 h-4 text-sky-500" /> Neural Link Audio
          </div>
          <div className="flex-1 bg-black/40 rounded p-2 text-xs font-mono text-emerald-400 overflow-y-auto leading-relaxed border border-slate-800 scrollbar-hide">
            {isSyncing ? (
              <div className="animate-pulse text-amber-500 whitespace-pre-wrap">
                {syncLog}
              </div>
            ) : isLive ? (
              transcription || <span className="animate-pulse text-sky-400">[ESTABLISHING TELEPATHIC CHANNEL... SPEAK, MEAT!]</span>
            ) : activeCase ? (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1 font-bold">
                  <FileText className="w-3 h-3" /> Case Log Snippet:
                </span>
                <span className="italic text-emerald-500/80 leading-tight line-clamp-3">
                  "{activeCase.transcription?.slice(0, 150)}..."
                </span>
              </div>
            ) : (
              <span className="text-slate-600 italic">Audio link dormant.</span>
            )}
          </div>
        </div>

        {/* Real YouTube Search Section */}
        <div className="vintage-panel border border-slate-700 p-3 rounded-lg flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-widest">
            <Search className="w-4 h-4" /> Archive Search Probe
          </div>
          
          <div className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRealMetadata(searchQuery)}
              placeholder="Query @oxyosbourne..."
              className="w-full bg-black/60 border border-slate-800 rounded pl-8 pr-2 py-2 text-[10px] focus:outline-none focus:border-red-500 transition-colors font-mono"
            />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          </div>

          <div className="max-h-24 overflow-y-auto space-y-1 scrollbar-hide">
            {isSyncing && !activeCase && <div className="text-[9px] text-amber-500 animate-pulse font-mono leading-tight">{syncLog}</div>}
            {searchResults.map(video => (
              <button 
                key={video.id}
                onClick={() => handleSelectCase(video)}
                className="w-full text-left bg-black/40 hover:bg-emerald-950/20 p-2 rounded border border-slate-800 transition-all group"
              >
                <div className="text-[10px] text-emerald-500 truncate font-bold group-hover:text-emerald-400">{video.title}</div>
              </button>
            ))}
          </div>

          {activeCase && (
            <div className="bg-emerald-900/10 border border-emerald-500/40 p-3 rounded-lg shadow-inner relative">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-emerald-400 leading-tight pr-4 truncate">
                  {activeCase.title}
                </div>
                <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <button 
                onClick={() => setShowFullTranscription(true)}
                className="w-full py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded text-[9px] font-bold uppercase text-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-3 h-3" /> Verify Case Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Operating Theater (Center) */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="vintage-panel border border-slate-700 p-4 rounded-lg flex-1 overflow-y-auto relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-700 tracking-[0.2em] font-['Orbitron']">CONSULTATION 01</div>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <FlaskConical className="w-16 h-16 mb-4 animate-bounce text-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-widest">Awaiting patient admission...</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded border-2 ${m.role === 'user' ? 'bg-slate-800 border-slate-600 rounded-br-none' : 'bg-black/80 border-emerald-900/50 text-emerald-50 rounded-bl-none shadow-[0_0_20px_rgba(16,185,129,0.1)]'}`}>
                  <div className="text-[9px] font-bold uppercase mb-2 opacity-50 flex items-center gap-2 tracking-widest font-['Orbitron']">
                    {m.role === 'user' ? <Activity className="w-3 h-3 text-sky-400" /> : <Skull className="w-3 h-3 text-emerald-500" />}
                    {m.role === 'user' ? 'Subject' : 'Dr. Oxy Osbourne'}
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">{m.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vintage-panel border border-slate-700 p-4 rounded-lg flex items-center gap-4 border-t-4 border-t-red-500">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Describe your surgical needs, patient..."
            className="flex-1 bg-black/80 border border-slate-800 rounded-lg px-6 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 font-mono"
          />
          <button onClick={handleSendText} className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"><Send className="w-5 h-5" /></button>
          <div className="h-10 w-px bg-slate-800 mx-2" />
          <button 
            onClick={isLive ? disconnectLive : connectLive}
            className={`p-4 rounded-full transition-all duration-300 ${isLive ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            {isLive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Analog Control Strip (Right) */}
      <div className="w-32 vintage-panel border border-slate-700 rounded-lg p-4 flex flex-col items-center gap-8 bg-gradient-to-b from-[#1a1a1e] to-black border-r-4 border-r-amber-500">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest [writing-mode:vertical-lr] mb-2 opacity-30 font-['Orbitron']">VOLTAGE MATRIX</div>
        
        <ControlKnob 
          label="Sedation" 
          value={knobValues.sedation} 
          min={0} max={1} 
          onChange={(v) => setKnobValues(p => ({ ...p, sedation: v }))} 
          color="emerald"
        />
        
        <ControlKnob 
          label="Voltage" 
          value={knobValues.voltage} 
          min={0} max={1} 
          onChange={(v) => setKnobValues(p => ({ ...p, voltage: v }))} 
          color="amber"
        />

        <div className="mt-auto space-y-4 w-full flex flex-col items-center">
          <div className="w-full h-1 bg-slate-800 rounded-full relative overflow-hidden">
             <div className="absolute inset-0 bg-emerald-500 animate-pulse" style={{ width: `${(vitals[vitals.length-1]?.heartRate - 60) * 2 || 50}%` }} />
          </div>
          
          <button onClick={() => window.location.reload()} className="group flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-lg bg-red-950/20 border-2 border-red-900 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-400 transition-all shadow-xl">
              <Power className="w-6 h-6 text-red-500 group-hover:text-white" />
            </div>
            <span className="text-[8px] font-bold text-red-900 uppercase">Emergency Kill</span>
          </button>
        </div>
      </div>

      <div className="crt-overlay fixed inset-0 z-50 pointer-events-none opacity-10"></div>
    </div>
  );
};

export default App;
