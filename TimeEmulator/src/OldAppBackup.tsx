import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, FastForward, Rewind, Upload, Activity, Link as LinkIcon, Info, Clock, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, TrendingDown, TrendingUp, Minus, Settings, Loader2 } from 'lucide-react';
import { parseLensHistory, parseSentimentCache, formatTime } from './utils';
import { SentimentItem, LensHistoryItem, Scenario } from './types';
import { generateScenarios, LLMConfig } from './llmService';

const START_TIME = new Date('2025-12-22T00:00:00Z').getTime();
const END_TIME = new Date().getTime(); // Now

type FileStatus = 'loading' | 'found' | 'missing';

export default function App() {
  const [currentTime, setCurrentTime] = useState(START_TIME);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(86400); // 1 day per real second

  const [sentimentData, setSentimentData] = useState<SentimentItem[]>([]);
  const [lensHistory, setLensHistory] = useState<LensHistoryItem[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [fileStatus, setFileStatus] = useState<{ sentiment: FileStatus, lens: FileStatus }>({
    sentiment: 'loading',
    lens: 'loading'
  });

  // LLM Settings State
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'ollama'>('gemini');
  // @ts-ignore
  const [geminiKey, setGeminiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen3.5:35b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load available Ollama models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch(`${ollamaUrl}/api/tags`);
        if (res.ok) {
          const data = await res.json();
          const modelNames = data.models?.map((m: any) => m.name) || [];
          setAvailableModels(modelNames);
          // Set default to qwen3.5:35b if available, otherwise first model
          if (modelNames.includes('qwen3.5:35b')) {
            setOllamaModel('qwen3.5:35b');
          } else if (modelNames.length > 0) {
            setOllamaModel(modelNames[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load Ollama models:', e);
      } finally {
        setLoadingModels(false);
      }
    };
    
    if (llmProvider === 'ollama') {
      setLoadingModels(true);
      loadModels();
    }
  }, [llmProvider, ollamaUrl]);

  // Auto-load files on startup
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const res = await fetch('/sentiment_cache_v2.json');
        if (res.ok) {
          const data = await res.json();
          setSentimentData(parseSentimentCache(data, START_TIME, END_TIME));
          setFileStatus(prev => ({ ...prev, sentiment: 'found' }));
        } else {
          setFileStatus(prev => ({ ...prev, sentiment: 'missing' }));
        }
      } catch (e) {
        setFileStatus(prev => ({ ...prev, sentiment: 'missing' }));
      }

      try {
        const res = await fetch('/lens_history.jsonl');
        if (res.ok) {
          const text = await res.text();
          setLensHistory(parseLensHistory(text));
          setFileStatus(prev => ({ ...prev, lens: 'found' }));
        } else {
          setFileStatus(prev => ({ ...prev, lens: 'missing' }));
        }
      } catch (e) {
        setFileStatus(prev => ({ ...prev, lens: 'missing' }));
      }
    };
    loadFiles();
  }, []);

  // Time Emulator Loop
  useEffect(() => {
    let lastTick = performance.now();
    let animationFrameId: number;

    const tick = (now: number) => {
      if (isPlaying) {
        const deltaMs = now - lastTick;
        const simulatedDeltaMs = deltaMs * speed;
        setCurrentTime((prev) => {
          const nextTime = prev + simulatedDeltaMs;
          if (nextTime >= END_TIME) {
            setIsPlaying(false);
            return END_TIME;
          }
          return nextTime;
        });
      }
      lastTick = now;
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, speed]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'sentiment' | 'lens') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        if (type === 'sentiment') {
          const json = JSON.parse(content);
          setSentimentData(parseSentimentCache(json, START_TIME, END_TIME));
        } else {
          setLensHistory(parseLensHistory(content));
        }
      } catch (error) {
        console.error(`Error parsing ${type} file:`, error);
        alert(`Failed to parse ${type} file. Please ensure it's valid JSON/JSONL.`);
      }
    };
    reader.readAsText(file);
  };

  // Filter data based on current simulated time
  const activeNews = useMemo(() => {
    return sentimentData.filter((item) => item.timestamp <= currentTime).reverse();
  }, [sentimentData, currentTime]);

  const activeLenses = useMemo(() => {
    return lensHistory.filter((item) => item.timestamp <= currentTime).reverse();
  }, [lensHistory, currentTime]);

  const triggerScenarioGeneration = async () => {
    if (activeLenses.length === 0 || activeNews.length === 0) return;
    
    setIsGenerating(true);
    try {
      const currentLens = activeLenses[0];
      const config: LLMConfig = {
        provider: llmProvider,
        geminiKey,
        ollamaUrl,
        ollamaModel
      };
      const newScenarios = await generateScenarios(config, currentLens, activeNews);
      setScenarios(newScenarios);
    } catch (e) {
      console.error("Failed to generate scenarios:", e);
      alert("Failed to generate scenarios. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      // Pausing -> trigger generation
      setIsPlaying(false);
      triggerScenarioGeneration();
    } else {
      // Playing
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar / Controls */}
      <div className="w-80 bg-slate-900 flex flex-col border-r border-slate-800 shadow-xl z-10">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Time Emulator
          </h1>
          <p className="text-xs text-slate-400">Simulate market news and scenario chains over time.</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Time Controls */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Playback Controls</h2>
            
            <div className="text-center mb-4">
              <div className="text-2xl font-mono text-white mb-1">{formatTime(currentTime)}</div>
              <div className="text-xs text-slate-500">Simulated Time</div>
            </div>

            <input
              type="range"
              min={START_TIME}
              max={END_TIME}
              value={currentTime}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-4 accent-blue-500"
            />

            <div className="flex items-center justify-center gap-4 mb-6">
              <button 
                onClick={() => setCurrentTime(START_TIME)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Reset to Start"
              >
                <Rewind className="w-5 h-5" />
              </button>
              <button 
                onClick={togglePlay}
                className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>
              <button 
                onClick={() => setCurrentTime(END_TIME)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Skip to End"
              >
                <FastForward className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Playback Speed</label>
              <select 
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={1}>1x (Realtime)</option>
                <option value={3600}>1 Hour / sec</option>
                <option value={86400}>1 Day / sec</option>
                <option value={604800}>1 Week / sec</option>
              </select>
            </div>
          </div>

          {/* Data Upload */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Data Sources</h2>
            <div className="space-y-3">
              
              {/* Sentiment Cache Status */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-200">sentiment_cache_v2.json</span>
                  {fileStatus.sentiment === 'loading' && <span className="text-xs text-slate-500">Scanning...</span>}
                  {fileStatus.sentiment === 'found' && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Found</span>}
                  {fileStatus.sentiment === 'missing' && <span className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing</span>}
                </div>
                {fileStatus.sentiment === 'missing' && (
                  <label className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-700 border border-slate-600 border-dashed rounded py-2 px-3 cursor-pointer transition-colors mt-2">
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs">Upload File</span>
                    <input type="file" accept=".json" className="hidden" onChange={(e) => handleFileUpload(e, 'sentiment')} />
                  </label>
                )}
                {fileStatus.sentiment === 'missing' && (
                  <p className="text-[10px] text-slate-500 mt-2 leading-tight">News feed cannot replay until provided.</p>
                )}
              </div>

              {/* Lens History Status */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-200">lens_history.jsonl</span>
                  {fileStatus.lens === 'loading' && <span className="text-xs text-slate-500">Scanning...</span>}
                  {fileStatus.lens === 'found' && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Found</span>}
                  {fileStatus.lens === 'missing' && <span className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing</span>}
                </div>
                {fileStatus.lens === 'missing' && (
                  <label className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-700 border border-slate-600 border-dashed rounded py-2 px-3 cursor-pointer transition-colors mt-2">
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs">Upload File</span>
                    <input type="file" accept=".jsonl,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'lens')} />
                  </label>
                )}
                {fileStatus.lens === 'missing' && (
                  <p className="text-[10px] text-slate-500 mt-2 leading-tight">Lens regime context unavailable until provided.</p>
                )}
              </div>

            </div>
          </div>

          {/* LLM Settings */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              LLM Settings
            </h2>
            <div className="space-y-4">
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${llmProvider === 'gemini' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setLlmProvider('gemini')}
                >
                  Gemini API
                </button>
                <button
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${llmProvider === 'ollama' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setLlmProvider('ollama')}
                >
                  Ollama (Local)
                </button>
              </div>

              {llmProvider === 'gemini' ? (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Available Models</label>
                    {loadingModels ? (
                      <div className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-xs text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading models...
                      </div>
                    ) : availableModels.length > 0 ? (
                      <select
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-xs focus:outline-none focus:border-blue-500 appearance-none"
                      >
                        {availableModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-xs text-slate-500">
                        No models found. Make sure Ollama is running.
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <button 
                onClick={triggerScenarioGeneration}
                disabled={isGenerating || activeNews.length === 0}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg py-2 text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                Force Generate Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
        <div className="flex-1 grid grid-cols-2 gap-px bg-slate-800 overflow-hidden">
          
          {/* Live News Feed */}
          <div className="bg-slate-950 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Live News Feed</h2>
              <span className="ml-auto text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400">
                {activeNews.length} items
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {activeNews.length === 0 ? (
                <div className="text-center text-slate-500 mt-10">No news available for this time period.</div>
              ) : (
                activeNews.map((news) => (
                  <NewsCard key={news.id} news={news} />
                ))
              )}
            </div>
          </div>

          {/* Scenario Chains */}
          <div className="bg-slate-950 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold text-white">Scenario Chains</h2>
              <span className="ml-auto text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400">
                {scenarios.length} active
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative">
              {isGenerating && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                  <p className="text-sm font-medium text-slate-300">Generating Scenarios via LLM...</p>
                  <p className="text-xs text-slate-500 mt-2">Analyzing {activeNews.length} recent headlines</p>
                </div>
              )}
              
              {scenarios.length === 0 && !isGenerating ? (
                <div className="text-center text-slate-500 mt-10">
                  <p>No scenario chains active yet.</p>
                  <p className="text-xs mt-2">Pause playback or click "Force Generate Now" to create scenarios.</p>
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <ScenarioCard key={scenario.scenario_id} scenario={scenario} />
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function NewsCard({ news }: { news: SentimentItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className="font-medium text-slate-100 leading-snug">{news.headline}</h3>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">{formatTime(news.timestamp)}</span>
          {news.lens_used && (
            <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
              {news.lens_used}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-3 bg-slate-900/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Asset Impact Analysis</h4>
          <div className="space-y-3">
            {Object.entries(news.scores).map(([asset, score]) => (
              <div key={asset} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm text-slate-200">{asset}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${score > 0 ? 'bg-emerald-500/10 text-emerald-400' : score < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700 text-slate-400'}`}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">{news.reasoning[asset]}</p>
                {news.lens_fit[asset] && news.lens_fit[asset] !== "No link." && (
                  <div className="flex items-start gap-1.5 text-xs text-purple-300/80 bg-purple-500/5 p-2 rounded border border-purple-500/10">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{news.lens_fit[asset]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg shadow-black/20">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-800/30">
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className="font-bold text-slate-100 text-lg leading-snug">{scenario.title}</h3>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold shrink-0 ${
            scenario.lifecycle_state === 'initializing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            scenario.lifecycle_state === 'growing' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            scenario.lifecycle_state === 'weakening' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-slate-700 text-slate-300 border border-slate-600'
          }`}>
            {scenario.lifecycle_state}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Lens: {scenario.dominant_lens}</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed font-medium">{scenario.core_thesis}</p>
        <div className="mt-2 text-xs text-slate-500 italic">Trigger: {scenario.trigger_reason}</div>
      </div>

      {/* Asset Impact */}
      <div className="p-4 border-b border-slate-800">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Asset Impact</h4>
        <div className="grid grid-cols-2 gap-2">
          {scenario.affected_assets.map(asset => (
            <div key={asset.asset} className="bg-slate-950 rounded p-2 border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs text-slate-200">{asset.asset}</span>
                {asset.direction === 'bullish' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
                 asset.direction === 'bearish' ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> :
                 <Minus className="w-3.5 h-3.5 text-slate-400" />}
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500">Score: {asset.net_direction_score > 0 ? '+' : ''}{asset.net_direction_score}</span>
                <span className="text-slate-500">Conf: {Math.round(asset.confidence * 100)}%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{asset.reasoning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chains */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="mb-4">
          <h4 className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider mb-2">Conventional Chain</h4>
          <p className="text-xs text-slate-300 mb-2">{scenario.conventional.summary}</p>
          <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500/30">
            {scenario.conventional.chain.map((step, i) => (
              <div key={i} className="text-xs text-slate-400 flex gap-2">
                <span className="text-emerald-500/50 shrink-0">→</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mb-2">What If Else (Rebuttal)</h4>
          <p className="text-xs text-slate-300 mb-1">{scenario.what_if_else.summary}</p>
          <p className="text-[10px] text-amber-400/80 mb-2 italic">Condition: {scenario.what_if_else.rebuttal_condition}</p>
          <div className="space-y-1.5 pl-2 border-l-2 border-amber-500/30">
            {scenario.what_if_else.alternate_chain.map((step, i) => (
              <div key={i} className="text-xs text-slate-400 flex gap-2">
                <span className="text-amber-500/50 shrink-0">→</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence & Signals */}
      <div className="p-4 bg-slate-950 text-[10px]">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Supporting Evidence</span>
            <ul className="list-disc pl-3 text-slate-400 space-y-1">
              {scenario.supporting_headlines.map((h, i) => <li key={i} className="truncate" title={h}>{h}</li>)}
            </ul>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Confirmation Signals</span>
            <ul className="list-disc pl-3 text-slate-400 space-y-1">
              {scenario.confirmation_signals.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
