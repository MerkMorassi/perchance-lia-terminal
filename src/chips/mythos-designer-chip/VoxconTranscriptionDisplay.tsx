import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Terminal, Shield, MessageSquare, AlertCircle, Globe, Search, X, Volume2, VolumeX, Square } from 'lucide-react';
import { VoxconMessage, VoxconSource } from '../../types/voxcon';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { windowsVoiceEngine } from '../../utils/windowsVoiceEngine';

interface VoxconTranscriptionDisplayProps {
  transcripts: any[]; // From useLiveVoiceControl
  currentTheme: ThemeId;
}

const SOURCE_CONFIG: Record<VoxconSource, { icon: any; color: string; label: string }> = {
  COMMAND: { icon: Shield, color: 'text-amber-400', label: 'CMD // BRIDGE' },
  OPERATOR: { icon: Terminal, color: 'text-cyan-400', label: 'OPERATOR' },
  SHIPWIDE: { icon: Radio, color: 'text-emerald-400', label: 'SHIPWIDE' },
  FLEET: { icon: Globe, color: 'text-blue-400', label: 'FLEET ORDERS' },
  MISSION: { icon: AlertCircle, color: 'text-purple-400', label: 'MISSION OBJ' },
  SYSTEM: { icon: AlertCircle, color: 'text-slate-400', label: 'SYS // AUDIT' },
  USER: { icon: Terminal, color: 'text-cyan-400', label: 'USER' },
  AI: { icon: MessageSquare, color: 'text-emerald-400', label: 'VOXCON' },
};

export const VoxconTranscriptionDisplay: React.FC<VoxconTranscriptionDisplayProps> = ({
  transcripts,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'COMMAND' | 'FLEET' | 'SHIPWIDE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsVolume, setTtsVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('voxcon_tts_volume');
      return saved !== null ? Number(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [ttsMuted, setTtsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('voxcon_tts_muted');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('voxcon_read_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [persistentLogs, setPersistentLogs] = useState<Record<string, VoxconMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('voxcon_persistent_logs');
      return saved ? JSON.parse(saved) : { COMMAND: [], FLEET: [], SHIPWIDE: [] };
    } catch {
      return { COMMAND: [], FLEET: [], SHIPWIDE: [] };
    }
  });

  const [timestampMode, setTimestampMode] = useState<'absolute' | 'relative'>(() => {
    try {
      return (localStorage.getItem('voxcon_timestamp_mode') as 'absolute' | 'relative') || 'relative';
    } catch {
      return 'relative';
    }
  });

  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    transcripts.forEach(t => {
      if (!seenMessageIdsRef.current.has(t.id)) {
        seenMessageIdsRef.current.add(t.id);
        const upper = (t.text || '').toUpperCase();
        if (upper.includes('CRITICAL')) {
          soundEngine.playCriticalAlert();
        } else if (upper.includes('THREAT')) {
          soundEngine.playThreatAlert();
        }
      }
    });
  }, [transcripts]);

  const formatMessageTimestamp = (msgId: string, absoluteTimestamp: string) => {
    if (timestampMode === 'absolute') {
      return absoluteTimestamp;
    }
    const parts = msgId.split('-');
    const epoch = Number(parts[0]);
    if (!epoch || isNaN(epoch)) return absoluteTimestamp;
    
    const diffSec = Math.floor((Date.now() - epoch) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return absoluteTimestamp;
  };

  const allMessageIds = React.useMemo(() => {
    const ids = new Set<string>();
    transcripts.forEach(t => ids.add(t.id));
    Object.values(persistentLogs).forEach(list => {
      list.forEach(m => ids.add(m.id));
    });
    return Array.from(ids);
  }, [transcripts, persistentLogs]);

  const unreadCount = allMessageIds.filter(id => !readIds.includes(id)).length;

  const hasUnreadCritical = React.useMemo(() => {
    const unreadTranscripts = transcripts.filter(t => !readIds.includes(t.id));
    if (unreadTranscripts.some(t => t.text.toLowerCase().includes('critical'))) {
      return true;
    }
    for (const list of Object.values(persistentLogs)) {
      if (list.some(m => !readIds.includes(m.id) && m.text.toLowerCase().includes('critical'))) {
        return true;
      }
    }
    return false;
  }, [transcripts, persistentLogs, readIds]);

  const markAllRead = () => {
    setReadIds(allMessageIds);
    localStorage.setItem('voxcon_read_ids', JSON.stringify(allMessageIds));
    soundEngine.playToggle();
  };

  // Map transcripts to VoxconMessages and update persistent logs
  useEffect(() => {
    const mapped: VoxconMessage[] = transcripts.map(t => {
      let source: VoxconSource = 'SYSTEM';
      if (t.role === 'user') source = 'USER';
      else if (t.role === 'model') source = 'AI';
      else if (t.role === 'command') source = 'COMMAND';
      else if (t.role === 'fleet') source = 'FLEET';
      else if (t.role === 'shipwide') source = 'SHIPWIDE';
      else if (t.role === 'mission') source = 'MISSION';
      
      return {
        id: t.id,
        source,
        text: t.text,
        timestamp: t.timestamp,
        priority: t.isCommand ? 'high' : 'normal',
        isCommand: t.isCommand
      };
    });

    // Handle persistence for specific sources
    const newPersistent = { ...persistentLogs };
    let changed = false;

    mapped.forEach(msg => {
      if (['COMMAND', 'FLEET', 'SHIPWIDE'].includes(msg.source)) {
        const sourceList = newPersistent[msg.source] || [];
        if (!sourceList.some(m => m.id === msg.id)) {
          newPersistent[msg.source] = [...sourceList, msg].slice(-100); // Keep last 100
          changed = true;
        }
      }
    });

    if (changed) {
      setPersistentLogs(newPersistent);
      localStorage.setItem('voxcon_persistent_logs', JSON.stringify(newPersistent));
    }
  }, [transcripts, persistentLogs]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, persistentLogs, activeTab, autoScroll]);

  const displayMessages = (activeTab === 'ALL' 
    ? transcripts.map(t => {
        let source: VoxconSource = 'SYSTEM';
        if (t.role === 'user') source = 'USER';
        else if (t.role === 'model') source = 'AI';
        else if (t.role === 'command') source = 'COMMAND';
        else if (t.role === 'fleet') source = 'FLEET';
        else if (t.role === 'shipwide') source = 'SHIPWIDE';
        else if (t.role === 'mission') source = 'MISSION';
        return {
          id: t.id,
          source,
          text: t.text,
          timestamp: t.timestamp,
          priority: t.isCommand ? 'high' : 'normal',
          isCommand: t.isCommand
        } as VoxconMessage;
      })
    : persistentLogs[activeTab] || [])
    .filter(msg => 
      searchQuery === '' || 
      msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.source.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const highlightText = (text: string, query: string) => {
    if (!query && !/\b(THREAT|CRITICAL|UPDATE|ALERT|PRIORITY|DANGER|WARNING)\b/i.test(text)) return text;
    
    // Priority keywords to always highlight if present
    const priorityKeywords = ['THREAT', 'CRITICAL', 'UPDATE', 'ALERT', 'PRIORITY', 'DANGER', 'WARNING'];
    
    // Build a regex that matches the query OR any priority keywords
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = [];
    if (query) parts.push(escape(query));
    priorityKeywords.forEach(k => parts.push(`\\b${escape(k)}\\b`));
    
    const regex = new RegExp(`(${parts.join('|')})`, 'gi');
    const segments = text.split(regex);
    
    return segments.map((segment, i) => {
      if (!segment) return null;
      if (regex.test(segment)) {
        const isPriority = priorityKeywords.some(k => segment.toUpperCase().includes(k));
        const isSearch = query && segment.toLowerCase().includes(query.toLowerCase());
        
        return (
          <span 
            key={i} 
            className={`font-bold px-0.5 rounded ${
              segment.toUpperCase().includes('CRITICAL') ? 'bg-red-500/30 text-red-200' : 
              segment.toUpperCase().includes('THREAT') ? 'bg-amber-500/40 text-amber-100' : 
              isSearch ? 'bg-cyan-500/30 text-cyan-100' : 
              'bg-slate-500/30 text-slate-100'
            }`}
          >
            {segment}
          </span>
        );
      }
      return segment;
    });
  };

  const getMessagePriority = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('critical')) {
      return { label: 'CRITICAL', color: 'bg-red-600/20 text-red-400 border-red-500/40', dot: 'bg-red-500' };
    }
    if (lowerText.includes('threat')) {
      return { label: 'THREAT', color: 'bg-amber-600/20 text-amber-400 border-amber-500/40', dot: 'bg-amber-500' };
    }
    return { label: 'ROUTINE', color: 'bg-cyan-900/20 text-cyan-400 border-cyan-500/40', dot: 'bg-cyan-500' };
  };

  const clearLogs = () => {
    const cleared = { COMMAND: [], FLEET: [], SHIPWIDE: [] };
    setPersistentLogs(cleared);
    localStorage.setItem('voxcon_persistent_logs', JSON.stringify(cleared));
  };

  const handleVolumeChange = (newVol: number) => {
    setTtsVolume(newVol);
    localStorage.setItem('voxcon_tts_volume', String(newVol));
  };

  const handleMuteToggle = () => {
    const newMuted = !ttsMuted;
    setTtsMuted(newMuted);
    localStorage.setItem('voxcon_tts_muted', JSON.stringify(newMuted));
    soundEngine.playToggle();
    if (newMuted) {
      windowsVoiceEngine.cancel();
      setSpeakingId(null);
    }
  };

  const handleToggleSpeech = (msg: VoxconMessage) => {
    if (speakingId === msg.id) {
      windowsVoiceEngine.cancel();
      setSpeakingId(null);
    } else {
      if (ttsMuted) return;
      soundEngine.playToggle();
      setSpeakingId(msg.id);
      windowsVoiceEngine.speak(msg.text, {
        volume: ttsVolume,
        onStart: () => setSpeakingId(msg.id),
        onEnd: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex flex-col bg-black/40 border-l-2 border-cyan-500 rounded-tr-md overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-tighter font-mono-data">
              LIVE COMMS MONITOR
            </span>
            {unreadCount > 0 && (
              <motion.button
                onClick={markAllRead}
                title={hasUnreadCritical ? "Unread CRITICAL message received!" : "Mark all as read"}
                animate={hasUnreadCritical ? {
                  scale: [1, 1.08, 1],
                  borderColor: ["rgba(239, 68, 68, 0.4)", "rgba(239, 68, 68, 1)", "rgba(239, 68, 68, 0.4)"],
                  backgroundColor: ["rgba(220, 38, 38, 0.1)", "rgba(220, 38, 38, 0.35)", "rgba(220, 38, 38, 0.1)"]
                } : {
                  scale: 1,
                  borderColor: "rgba(245, 158, 11, 0.5)",
                  backgroundColor: "rgba(245, 158, 11, 0.2)"
                }}
                transition={hasUnreadCritical ? {
                  duration: 1.0,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
                className={`px-1.5 py-0.2 rounded text-[8px] font-bold font-mono-data flex items-center gap-1 transition-all ${
                  hasUnreadCritical 
                    ? 'text-red-200 border border-red-500' 
                    : 'text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                }`}
              >
                <span className={`w-1 h-1 rounded-full ${hasUnreadCritical ? 'bg-red-400' : 'bg-amber-400'} animate-pulse`} />
                <span>{unreadCount} {hasUnreadCritical ? 'CRITICAL' : 'UNREAD'}</span>
              </motion.button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Global TTS Volume and Mute Toggle */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded px-1.5 py-0.5">
              <button
                onClick={handleMuteToggle}
                title={ttsMuted ? "Unmute TTS" : "Mute TTS"}
                className="text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
              >
                {ttsMuted ? (
                  <VolumeX className="w-3 h-3 text-red-500 animate-pulse" />
                ) : (
                  <Volume2 className={`w-3 h-3 ${ttsVolume > 0 ? 'text-cyan-400' : 'text-slate-500'}`} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={ttsMuted ? 0 : ttsVolume}
                disabled={ttsMuted}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                title={`TTS Volume: ${Math.round((ttsMuted ? 0 : ttsVolume) * 100)}%`}
                className="w-10 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ padding: 0 }}
              />
            </div>

            <button 
              onClick={() => {
                soundEngine.playToggle();
                const next = timestampMode === 'absolute' ? 'relative' : 'absolute';
                setTimestampMode(next);
                localStorage.setItem('voxcon_timestamp_mode', next);
              }}
              title={`Timestamp mode: ${timestampMode.toUpperCase()} (Click to toggle)`}
              className="px-1.5 py-0.5 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:text-white text-[7px] font-bold uppercase transition-all"
            >
              TIME: {timestampMode === 'absolute' ? 'ABS' : 'REL'}
            </button>

            <button 
              onClick={() => {
                soundEngine.playToggle();
                setAutoScroll(!autoScroll);
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                autoScroll 
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' 
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              <span className={`w-1 h-1 rounded-full ${autoScroll ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[7px] font-bold uppercase tracking-tighter">Auto-Scroll</span>
            </button>
          </div>
        </div>
        
        {/* Interactive Filter Buttons */}
        <div className="flex items-center gap-px bg-white/5 p-0.5">
          {(['ALL', 'SHIPWIDE', 'FLEET', 'COMMAND'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                soundEngine.playBeep(activeTab === tab ? 440 : 880, 'sine', 0.05);
                setActiveTab(tab);
              }}
              className={`flex-1 py-1 text-[8px] font-bold uppercase transition-all ${
                activeTab === tab 
                  ? 'bg-cyan-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-2 py-1.5 border-t border-white/5 bg-black/20 flex items-center gap-2">
          <Search className="w-3 h-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FILTER COMMS..."
            className="flex-grow bg-transparent border-none outline-none text-[9px] text-cyan-100 placeholder:text-slate-600 font-mono-data"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-3 h-3 text-slate-500 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-grow overflow-y-auto overflow-x-hidden space-y-2 pr-1 custom-scrollbar min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence initial={false}>
          {displayMessages.length === 0 ? (
            <div className="text-[9px] text-slate-500 italic p-3 bg-black/20 border border-slate-800/40 rounded flex flex-col items-center justify-center h-24 text-center">
              <span>Waiting for {activeTab.toLowerCase()} transmissions...</span>
              {activeTab !== 'ALL' && (
                <span className="text-[7px] mt-1 opacity-60">Persistent logs are preserved across sessions</span>
              )}
            </div>
          ) : (
            displayMessages.map((msg, idx) => {
              const config = SOURCE_CONFIG[msg.source] || SOURCE_CONFIG.SYSTEM;
              const Icon = config.icon;
              const priority = getMessagePriority(msg.text);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`p-2 rounded border-l-2 bg-black/30 shadow-sm ${
                    msg.isCommand ? 'border-amber-500/40' : 'border-slate-700/30'
                  }`}
                  style={{ 
                    borderColor: msg.isCommand ? theme.colors.gold : theme.colors.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3 h-3 ${config.color}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      
                      {/* Priority Tag */}
                      <div className={`px-1.5 py-0.5 rounded-sm text-[7px] font-bold border flex items-center gap-1 leading-none ${priority.color}`}>
                        <span className={`w-1 h-1 rounded-full ${priority.dot} animate-pulse`} />
                        {priority.label}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSpeech(msg)}
                        title={speakingId === msg.id ? "Stop Audio" : "Play Audio"}
                        className={`px-1.5 py-0.5 rounded border transition-all flex items-center gap-1 ${
                          speakingId === msg.id 
                            ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                            : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500/50'
                        }`}
                      >
                        {speakingId === msg.id ? (
                          <Square className="w-2.5 h-2.5" />
                        ) : (
                          <Volume2 className="w-2.5 h-2.5" />
                        )}
                        <span className="text-[7px] font-bold uppercase">{speakingId === msg.id ? 'STOP' : 'TTS'}</span>
                      </button>
                      <span className="text-[8px] text-slate-500 font-mono-data" title={`Absolute: ${msg.timestamp}`}>
                        {formatMessageTimestamp(msg.id, msg.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${
                    msg.source === 'AI' ? 'text-emerald-100' : 'text-slate-300'
                  } font-mono-data break-words`}>
                    {highlightText(msg.text, searchQuery)}
                  </p>
                  {msg.isCommand && (
                    <div className="mt-1 pt-1 border-t border-amber-900/20 flex items-center gap-1">
                      <Terminal className="w-2.5 h-2.5 text-amber-500" />
                      <span className="text-[8px] text-amber-500 font-bold uppercase">Order Processed</span>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {activeTab !== 'ALL' && persistentLogs[activeTab].length > 0 && (
        <button 
          onClick={clearLogs}
          className="text-[7px] text-slate-600 hover:text-red-400 uppercase font-bold self-end mr-1 transition-colors"
        >
          Clear Persistent {activeTab} Logs
        </button>
      )}
    </div>
  );
};
