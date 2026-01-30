
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
  ExternalLink
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const fetchRealMetadata = async (query: string) => {
    setIsSyncing(true);
    setSyncLog(`INITIALIZING SURGICAL PROBE...\nTARGET: youtube.com/@oxyosbourne\nQUERY: ${query}\nPULLING REAL-TIME METADATA...`);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: `Fetch the latest video metadata (title, URL, description) from the YouTube channel @oxyosbourne related to: ${query}. Return the results as a list.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedResults: VideoMetaData[] = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any, idx: number) => ({
          id: `real-${idx}`,
          title: chunk.web.title || "Unknown Procedure",
          url: chunk.web.uri || "https://youtube.com/@oxyosbourne",
        }));

      setSearchResults(extractedResults.slice(0, 5));
      setSyncLog(`PROBE SUCCESSFUL.\nFOUND ${extractedResults.length} REAL DATA POINTS.\nNEURAL LINK READY.`);
    } catch (err) {
      setSyncLog(`CRITICAL ERROR: Probe failed.\nREASON: ${err instanceof Error ? err.message : 'Unknown circuit failure'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectCase = (video: VideoMetaData) => {
    setActiveCase(video);
    setSearchResults([]);
    setSearchQuery('');
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: `[REAL DATA SYNCED] VIDEO: ${video.title}\nID: ${video.id}\n"I've analyzed the fiber optics of this procedure. We're going in deep, patient! SHARRRRP!"`,
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
          systemInstruction: OXY_SYSTEM_PROMPT + (activeCase ? `\nCURRENT CASE CONTEXT: ${activeCase.title} (${activeCase.url})` : ''),
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
          systemInstruction: OXY_SYSTEM_PROMPT + (activeCase ? `\nCURRENT CASE CONTEXT: ${activeCase.title}` : ''),
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
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] p-4 text-slate-300 gap-4 overflow-hidden relative">
      {/* Surgical Monitor (Left) */}
      <div className="w-1/4 flex flex-col gap-4">
        <div className="vintage-panel border border-slate-700 p-4 rounded-lg flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <h1 className="text-xl font-bold font-['Orbitron'] text-emerald-500 flex items-center gap-2 glow-green">
              <Skull className="w-6 h-6" /> DR. OXY
            </h1>
            <p className="text-[10px] uppercase text-slate-500 font-bold">REAL-TIME DATA CONSOLE</p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 shadow-red-500/50 shadow-md'}`} />
        </div>

        <div className="vintage-panel border border-slate-700 p-3 rounded-lg flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Activity className="w-4 h-4 text-emerald-500" /> Bio-Grounding Vitals
          </div>
          <VitalsMonitor data={vitals} />
          <div className="mt-2 space-y-2">
            <div className="bg-black/80 border border-slate-800 p-2 rounded flex justify-between items-center">
              <span className="text-[10px] uppercase text-slate-500">Probe Strength</span>
              <span className="text-emerald-400 font-mono text-xs">{(knobValues.voltage * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Real YouTube Search Section */}
        <div className="vintage-panel border border-slate-700 p-3 rounded-lg flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-widest">
            <Youtube className="w-4 h-4" /> YouTube Archive Sync
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

          <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-hide">
            {isSyncing && <div className="text-[9px] text-amber-500 animate-pulse font-mono leading-tight">{syncLog}</div>}
            {!isSyncing && searchResults.map(video => (
              <button 
                key={video.id}
                onClick={() => handleSelectCase(video)}
                className="w-full text-left bg-black/40 hover:bg-emerald-950/20 p-2 rounded border border-slate-800 transition-all group"
              >
                <div className="text-[10px] text-emerald-500 truncate font-bold group-hover:text-emerald-400">{video.title}</div>
                <div className="text-[8px] text-slate-600 truncate flex items-center gap-1 mt-1">
                  <ExternalLink className="w-2 h-2" /> {video.url}
                </div>
              </button>
            ))}
          </div>

          {activeCase && (
            <div className="bg-emerald-900/20 border border-emerald-500/50 p-3 rounded-lg shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-black text-[7px] font-bold px-2 uppercase">SYNECED</div>
              <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-2">
                <ChevronRight className="w-3 h-3" /> {activeCase.title}
              </div>
              <a href={activeCase.url} target="_blank" className="text-[8px] text-slate-500 underline truncate block">{activeCase.url}</a>
            </div>
          )}
        </div>
      </div>

      {/* Operating Theater (Center) */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="vintage-panel border border-slate-700 p-4 rounded-lg flex-1 overflow-y-auto relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-opacity-5">
          <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-700 tracking-[0.2em]">CONSULTATION THEATER 01</div>
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded border-2 ${m.role === 'user' ? 'bg-slate-800 border-slate-600 rounded-br-none' : 'bg-black/60 border-emerald-900/50 text-emerald-50 rounded-bl-none shadow-[0_0_20px_rgba(16,185,129,0.1)]'}`}>
                  <div className="text-[9px] font-bold uppercase mb-2 opacity-50 flex items-center gap-2 tracking-widest font-['Orbitron']">
                    {m.role === 'user' ? <Activity className="w-3 h-3 text-sky-400" /> : <Skull className="w-3 h-3 text-emerald-500" />}
                    {m.role === 'user' ? 'The Meat' : 'Dr. Oxy Osbourne'}
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
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest [writing-mode:vertical-lr] mb-2 opacity-30">VOLTAGE MATRIX</div>
        
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

        <div className="w-full h-1 bg-slate-800 rounded-full mt-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-500 animate-ping opacity-20" />
        </div>

        <button onClick={() => window.location.reload()} className="mt-auto group flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-lg bg-red-950/20 border-2 border-red-900 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-400 transition-all shadow-xl">
            <Power className="w-6 h-6 text-red-500 group-hover:text-white" />
          </div>
          <span className="text-[8px] font-bold text-red-900 uppercase">Emergency Kill</span>
        </button>
      </div>

      <div className="crt-overlay fixed inset-0 z-50 pointer-events-none opacity-10"></div>
    </div>
  );
};

export default App;
