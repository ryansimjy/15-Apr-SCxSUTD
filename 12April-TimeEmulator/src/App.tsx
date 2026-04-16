import React, { useState, useEffect, useMemo, useRef, createContext, ReactNode } from 'react';
import { Play, Pause, FastForward, Rewind, Upload, Activity, Link as LinkIcon, Info, Clock, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, TrendingDown, TrendingUp, Minus, Settings, Loader2, Sun, Moon, BarChart3, Target, Award, X } from 'lucide-react';
import { parseLensHistory, parseSentimentCache, formatTime } from './utils';
import { SentimentItem, LensHistoryItem, Scenario } from './types';
import { generateScenarios, LLMConfig } from './llmService';
import { TimelineTab } from './components/TimelineTab';
import { WatchlistTab } from './components/WatchlistTab';
import { GraphTab } from './components/GraphTab';
import { AssetHeatmap } from './components/AssetHeatmap';
import { AnalyticsTab } from './components/AnalyticsTab';
import { ContradictionAlertTab } from './components/ContradictionAlertTab';

const START_TIME = new Date('2025-12-22T00:00:00Z').getTime();
const END_TIME = new Date().getTime(); // Now

type FileStatus = 'loading' | 'found' | 'missing';
type Theme = 'light' | 'dark';

// Theme Context
interface ThemeContextType {
  theme: Theme;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider: React.FC<{ children: ReactNode; theme: Theme }> = ({ children, theme }) => (
  <ThemeContext.Provider value={{ theme }}>
    {children}
  </ThemeContext.Provider>
);

export default function App() {
  const [currentTime, setCurrentTime] = useState(START_TIME);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(86400); // 1 day per real second

  const [sentimentData, setSentimentData] = useState<SentimentItem[]>([]);
  const [lensHistory, setLensHistory] = useState<LensHistoryItem[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Analysis Panel tab state
  const [activeTab, setActiveTab] = useState<'timeline' | 'watchlist' | 'graph'>('timeline');

  // Sidebar tabs state
  const [sidebarTab, setSidebarTab] = useState<'controls' | 'analytics' | 'contradiction'>('controls');

  // Watchlist state
  const [watchlistAssets, setWatchlistAssets] = useState<Set<string>>(new Set(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA']));

  // Theme state
  const [theme, setTheme] = useState<Theme>('dark');
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

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
      setIsPlaying(false);
      triggerScenarioGeneration();
    } else {
      setIsPlaying(true);
    }
  };

  const activeNews = useMemo(() => {
    return sentimentData.filter((item) => item.timestamp <= currentTime).reverse();
  }, [sentimentData, currentTime]);

  return (
    <ThemeProvider theme={theme}>
      <div className={`flex h-screen font-sans overflow-hidden ${
        theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-200'
      }`}>
        {/* Column 1: Control Sidebar */}
        <div className={`w-80 flex flex-col border-r shadow-xl z-10 ${
          theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`p-6 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className="flex justify-between items-center mb-2">
              <h1 className={`text-xl font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                <Clock className={`w-5 h-5 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                Time Emulator
              </h1>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-800'}`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Simulate market news and scenario chains over time.</p>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Time Controls */}
            <div className="mb-8">
              <h2 className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider mb-4`}>Playback Controls</h2>

              <div className="text-center mb-4">
                <div className={`text-2xl font-mono ${theme === 'light' ? 'text-slate-900' : 'text-white'} mb-1`}>{formatTime(currentTime)}</div>
                <div className="text-xs text-slate-500">Simulated Time</div>
              </div>

              <input
                type="range"
                min={START_TIME}
                max={END_TIME}
                value={currentTime}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer mb-4 accent-blue-500"
              />

              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setCurrentTime(START_TIME)}
                  className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
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
                  className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                  title="Skip to End"
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Playback Speed</label>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className={`w-full rounded-md py-2 px-3 text-sm focus:outline-none focus:border-blue-500 ${
                    theme === 'light'
                      ? 'bg-slate-100 border border-slate-300 text-slate-900'
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
                  }`}
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
              <h2 className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider mb-4`}>Data Sources</h2>
              <div className="space-y-3">

                {/* Sentiment Cache Status */}
                <div className={`rounded-lg p-3 ${theme === 'light' ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>sentiment_cache_v2.json</span>
                    {fileStatus.sentiment === 'loading' && <span className="text-xs text-slate-500">Scanning...</span>}
                    {fileStatus.sentiment === 'found' && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Found</span>}
                    {fileStatus.sentiment === 'missing' && <span className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing</span>}
                  </div>
                  {fileStatus.sentiment === 'missing' && (
                    <label className="flex items-center justify-center gap-2 w-full hover:bg-slate-700 border border-dashed rounded py-2 px-3 cursor-pointer transition-colors mt-2"
                    >
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
                <div className={`rounded-lg p-3 ${theme === 'light' ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>lens_history.jsonl</span>
                    {fileStatus.lens === 'loading' && <span className="text-xs text-slate-500">Scanning...</span>}
                    {fileStatus.lens === 'found' && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Found</span>}
                    {fileStatus.lens === 'missing' && <span className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing</span>}
                  </div>
                  {fileStatus.lens === 'missing' && (
                    <label className="flex items-center justify-center gap-2 w-full hover:bg-slate-700 border border-dashed rounded py-2 px-3 cursor-pointer transition-colors mt-2">
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
              <h2 className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider mb-4 flex items-center gap-2`}>
                <Settings className="w-4 h-4" />
                LLM Settings
              </h2>
              <div className="space-y-4">
                <div className={`flex rounded-lg p-1 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <button
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${llmProvider === 'gemini' ? 'bg-blue-600 text-white' : `${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} hover:${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}`}
                    onClick={() => setLlmProvider('gemini')}
                  >
                    Gemini API
                  </button>
                  <button
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${llmProvider === 'ollama' ? 'bg-blue-600 text-white' : `${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} hover:${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}`}
                    onClick={() => setLlmProvider('ollama')}
                  >
                    Ollama (Local)
                  </button>
                </div>

                {llmProvider === 'gemini' ? (
                  <div className="space-y-2">
                    <label className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Gemini API Key</label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className={`w-full rounded-md py-2 px-3 text-xs focus:outline-none focus:border-blue-500 ${
                        theme === 'light' ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-slate-200'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Available Models</label>
                      {loadingModels ? (
                        <div className={`w-full rounded-md py-2 px-3 text-xs flex items-center gap-2 ${theme === 'light' ? 'bg-white border border-slate-300 text-slate-500' : 'bg-slate-900 border border-slate-700 text-slate-500'}`}>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading models...
                        </div>
                      ) : availableModels.length > 0 ? (
                        <select
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          className={`w-full rounded-md py-2 px-3 text-xs focus:outline-none focus:border-blue-500 appearance-none ${
                            theme === 'light' ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-slate-200'
                          }`}
                        >
                          {availableModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      ) : (
                        <div className={`w-full rounded-md py-2 px-3 text-xs ${theme === 'light' ? 'bg-white border border-slate-300 text-slate-500' : 'bg-slate-900 border border-slate-700 text-slate-500'}`}>
                          No models found. Make sure Ollama is running.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={triggerScenarioGeneration}
                  disabled={isGenerating || activeNews.length === 0}
                  className={`w-full rounded-lg py-2 text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                    isGenerating || activeNews.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    theme === 'light'
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Force Generate Now
                </button>
              </div>
            </div>

            {/* Analytics Tab */}
            <div className="mt-8">
              <h2 className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider mb-4`}>Analysis</h2>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSidebarTab('controls')}
                  className={`flex-1 text-xs py-2 rounded-md transition-colors ${sidebarTab === 'controls' ? 'bg-blue-600 text-white' : `${theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'} hover:${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}`}
                >
                  Controls
                </button>
                <button
                  onClick={() => setSidebarTab('analytics')}
                  className={`flex-1 text-xs py-2 rounded-md transition-colors ${sidebarTab === 'analytics' ? 'bg-blue-600 text-white' : `${theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'} hover:${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}`}
                >
                  <BarChart3 className="w-3 h-3 inline mr-1" />
                  Analytics
                </button>
                <button
                  onClick={() => setSidebarTab('contradiction')}
                  className={`flex-1 text-xs py-2 rounded-md transition-colors ${sidebarTab === 'contradiction' ? 'bg-blue-600 text-white' : `${theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'} hover:${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}`}
                >
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Alerts
                </button>
              </div>

              {sidebarTab === 'analytics' && (
                <AnalyticsTab theme={theme} scenarios={scenarios} activeNews={activeNews} />
              )}
              {sidebarTab === 'contradiction' && (
                <ContradictionAlertTab theme={theme} scenarios={scenarios} />
              )}
            </div>
          </div>
        </div>

        {/* Columns 2 & 3: Main Content Grid - Fixed 2x2 grid */}
        <div className={`flex-1 grid grid-cols-2 grid-rows-2 gap-px overflow-hidden ${
          theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'
        }`}>

          {/* Live News Feed - Top Left (row 1, col 1) */}
          <div className={`flex flex-col overflow-hidden ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-950'}`}>
            <div className={`p-4 border-b shrink-0 sticky flex items-center gap-2 ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
              <Activity className="w-5 h-5 text-emerald-500" />
              <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>Live News Feed</h2>
              <span className={`ml-auto text-xs ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-400'} px-2 py-1 rounded-full`}>
                {activeNews.length} items
              </span>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
              {activeNews.length === 0 ? (
                <div className={`text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'} mt-10`}>No news available for this time period.</div>
              ) : (
                activeNews.map((news) => (
                  <NewsCard key={news.id} news={news} theme={theme} />
                ))
              )}
            </div>
          </div>

          {/* Scenario Chains - Top Right (row 1, col 2) */}
          <div className={`flex flex-col overflow-hidden ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-950'}`}>
            <div className={`p-4 border-b shrink-0 sticky flex items-center gap-2 ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
              <LinkIcon className="w-5 h-5 text-purple-500" />
              <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>Scenario Chains</h2>
              <span className={`ml-auto text-xs ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-400'} px-2 py-1 rounded-full`}>
                {scenarios.length} active
              </span>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
              {isGenerating && (
                <div className={`absolute inset-0 ${theme === 'light' ? 'bg-slate-50/80' : 'bg-slate-950/80'} backdrop-blur-sm z-20 flex flex-col items-center justify-center`}>
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                  <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>Generating Scenarios via LLM...</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'} mt-2`}>Analyzing {activeNews.length} recent headlines</p>
                </div>
              )}

              {scenarios.length === 0 && !isGenerating ? (
                <div className={`text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'} mt-10`}>
                  <p>No scenario chains active yet.</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'} mt-2`}>Pause playback or click "Force Generate Now" to create scenarios.</p>
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <ScenarioCard key={scenario.scenario_id} scenario={scenario} theme={theme} />
                ))
              )}
            </div>
          </div>

          {/* Analysis Panel - Bottom Left (row 2, col 1) */}
          <div className={`flex flex-col overflow-hidden ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-950'}`}>
            <div className={`p-4 border-b shrink-0 sticky ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
              <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>Analysis Panel</h2>
              <div className="flex gap-2 mt-2">
                {['Timeline', 'Watchlist', 'Graph'].map((tab) => (
                  <button
                    key={tab}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      activeTab === tab.toLowerCase()
                        ? 'bg-blue-600 text-white'
                        : theme === 'light'
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    onClick={() => setActiveTab(tab.toLowerCase() as 'timeline' | 'watchlist' | 'graph')}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
              {activeTab === 'timeline' && <TimelineTab theme={theme} activeNews={activeNews} />}
              {activeTab === 'watchlist' && <WatchlistTab theme={theme} activeNews={activeNews} scenarios={scenarios} />}
              {activeTab === 'graph' && <GraphTab theme={theme} activeNews={activeNews} scenarios={scenarios} />}
            </div>
          </div>

          {/* Asset Impact Heatmap - Bottom Right (row 2, col 2) */}
          <div className={`flex flex-col overflow-hidden ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-950'}`}>
            <div className={`p-4 border-b shrink-0 sticky ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
              <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>Asset Impact Heatmap</h2>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-950'}`}>
              <AssetHeatmap theme={theme} scenarios={scenarios} />
            </div>
          </div>

        </div>
      </div>
    </ThemeProvider>
  );
}

function NewsCard({ news, theme }: { news: SentimentItem; theme: Theme }) {
  const [expanded, setExpanded] = useState(false);
  const isLight = theme === 'light';

  return (
    <div className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-xl overflow-hidden hover:border-slate-700 transition-colors`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'} leading-snug`}>{news.headline}</h3>
          {expanded ? <ChevronUp className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-slate-500'} shrink-0`} /> : <ChevronDown className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-slate-500'} shrink-0`} />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{formatTime(news.timestamp)}</span>
          {news.lens_used && (
            <span className={`${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/10 text-purple-400'} px-2 py-0.5 rounded-full border ${isLight ? 'border-purple-300' : 'border-purple-500/20'}`}>
              {news.lens_used}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className={`px-4 pb-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800/50'} pt-3 ${isLight ? 'bg-slate-50' : 'bg-slate-900/50'}`}>
          <h4 className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-wider mb-3`}>Asset Impact Analysis</h4>
          <div className="space-y-3">
            {Object.entries(news.scores).map(([asset, score]) => (
              <div key={asset} className={`${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} rounded-lg p-3 border`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-medium text-sm ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{asset}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    score > 0 ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400') :
                    score < 0 ? (isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/10 text-rose-400') :
                    (isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-400')
                  }`}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'} mb-2 leading-relaxed`}>{news.reasoning[asset]}</p>
                {news.lens_fit[asset] && news.lens_fit[asset] !== "No link." && (
                  <div className={`flex items-start gap-1.5 text-xs ${isLight ? 'text-purple-800 bg-purple-50' : 'text-purple-300/80 bg-purple-500/5'} p-2 rounded border ${isLight ? 'border-purple-200' : 'border-purple-500/10'}`}>
                    <Info className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
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

function ScenarioCard({ scenario, theme }: { scenario: Scenario; theme: Theme }) {
  const isLight = theme === 'light';

  const getLifecycleStyles = (state: string) => {
    if (state === 'initializing') {
      return isLight ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
    if (state === 'growing') {
      return isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    if (state === 'mature') {
      return isLight ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    }
    if (state === 'weakening' || state === 'contradictory') {
      return isLight ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
    return isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const renderChain = (steps: string[], prefix: string = '→') => (
    <div className="space-y-1">
      {steps.map((step, idx) => (
        <div key={idx} className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
          <span className={`${isLight ? 'text-slate-400' : 'text-slate-500'} mr-2`}>{prefix}</span>
          {step}
        </div>
      ))}
    </div>
  );

  const renderSignals = (signals: string[], isConfirmation: boolean) => (
    <div className={`grid grid-cols-2 gap-2 mt-2`}>
      {signals.slice(0, 4).map((signal, idx) => (
        <div key={idx} className={`text-xs px-2 py-1.5 rounded ${
          isConfirmation
            ? (isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')
            : (isLight ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')
        }`}>
          {idx + 1}. {signal}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'} border rounded-xl overflow-hidden shadow-lg`}>
      {/* Header */}
      <div className={`p-4 border-b ${isLight ? 'border-slate-200 bg-slate-50/30' : 'border-slate-800 bg-slate-800/30'}`}>
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'} text-lg leading-snug`}>{scenario.title}</h3>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold shrink-0 ${getLifecycleStyles(scenario.lifecycle_state)}`}>
            {scenario.lifecycle_state}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className={`${isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'} px-2 py-0.5 rounded border ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>Lens: {scenario.dominant_lens}</span>
          <span className={`${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'} px-2 py-0.5 rounded border ${isLight ? 'border-blue-200' : 'border-blue-500/20'}`}>
            {Math.round(scenario.confidence_score * 100)}% confidence
          </span>
        </div>
        <p className={`text-sm ${isLight ? 'text-slate-800' : 'text-slate-300'} leading-relaxed font-medium`}>{scenario.core_thesis}</p>
        <div className={`mt-2 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-1`}>
          <Info className="w-3 h-3" />
          Trigger: {scenario.trigger_reason}
        </div>
      </div>

      {/* Base Case Chain */}
      <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-800/50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-wider`}>Base Case Path</span>
        </div>
        {renderChain(scenario.conventional.chain, '→')}
      </div>

      {/* What-If-Else / Contrarian */}
      <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-800/50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
          <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-wider`}>What If Else</span>
        </div>
        <div className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'} mb-1 italic`}>
          {scenario.what_if_else.rebuttal_condition}
        </div>
        {renderChain(scenario.what_if_else.alternate_chain, '→')}
      </div>

      {/* Signals Section */}
      <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-800/50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-wider`}>Confirmation Signals</span>
        </div>
        {renderSignals(scenario.confirmation_signals, true)}
        <div className="flex items-center gap-2 mt-3 mb-2">
          <X className={`w-4 h-4 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
          <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-wider`}>Invalidation Signals</span>
        </div>
        {renderSignals(scenario.invalidation_signals, false)}
      </div>

      {/* Asset Impact */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'} font-semibold uppercase tracking-wider`}>Affected Assets</span>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{scenario.affected_assets.length} assets</span>
        </div>
        <div className="space-y-2">
          {scenario.affected_assets.map((asset) => (
            <div key={asset.asset} className={`p-3 rounded-lg ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-800/50 border border-slate-700/50'} border`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{asset.asset}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    asset.net_direction_score > 0
                      ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400')
                      : asset.net_direction_score < 0
                      ? (isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-400')
                      : (isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-400')
                  }`}>
                    {asset.net_direction_score > 0 ? '+' : ''}{asset.net_direction_score.toFixed(2)}
                  </span>
                  {asset.direction === 'bullish' && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                  {asset.direction === 'bearish' && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                  {asset.direction === 'neutral' && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Conf: {Math.round(asset.confidence * 100)}%
                </span>
                <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                  <TrendingUp className="w-3 h-3" />
                  {asset.support_count}
                </span>
                <span className={`flex items-center gap-1 ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                  <TrendingDown className="w-3 h-3" />
                  {asset.contradiction_count}
                </span>
              </div>
              {asset.reasoning && (
                <div className={`mt-2 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'} italic`}>
                  {asset.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
