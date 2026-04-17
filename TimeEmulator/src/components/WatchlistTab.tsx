import React, { useState, useMemo } from 'react';
import { Star, StarOff, TrendingUp, TrendingDown, Minus, Target, AlertCircle } from 'lucide-react';
import { SentimentItem, Scenario } from '../types';

interface WatchlistItem {
  asset: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  impactScore: number;
  confidence: number;
  supportCount: number;
  contradictionCount: number;
  mentionCount: number;
  relevance: 'direct' | 'related' | 'proxy';
  reason: string;
  scenarioIds: string[];
}

interface WatchlistTabProps {
  theme: 'light' | 'dark';
  activeNews: SentimentItem[];
  scenarios: Scenario[];
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({ theme, activeNews, scenarios }) => {
  const isLight = theme === 'light';
  const isLightTheme = theme === 'light';
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  // Generate dynamic watchlist from scenarios and news
  const watchlistItems = useMemo<WatchlistItem[]>(() => {
    const assetMap = new Map<string, WatchlistItem>();

    // Collect all assets from scenarios
    scenarios.forEach(scenario => {
      scenario.affected_assets.forEach(asset => {
        const key = asset.asset.toLowerCase();

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            asset: asset.asset,
            direction: asset.direction === 'mixed' ? 'neutral' : asset.direction,
            impactScore: asset.net_direction_score,
            confidence: asset.confidence,
            supportCount: asset.support_count,
            contradictionCount: asset.contradiction_count,
            mentionCount: 0,
            relevance: 'direct',
            reason: asset.reasoning || 'Affected by current scenario',
            scenarioIds: [scenario.scenario_id],
          });
        } else {
          const existing = assetMap.get(key)!;
          existing.impactScore = (existing.impactScore + asset.net_direction_score) / 2;
          existing.confidence = (existing.confidence + asset.confidence) / 2;
          existing.supportCount += asset.support_count;
          existing.contradictionCount += asset.contradiction_count;
          existing.mentionCount += 1;
          existing.scenarioIds.push(scenario.scenario_id);
        }
      });
    });

    // Also collect assets directly mentioned in news sentiment
    activeNews.forEach(news => {
      Object.entries(news.scores).forEach(([asset, score]) => {
        const key = asset.toLowerCase();
        const direction = score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral';

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            asset: asset,
            direction: direction,
            impactScore: score,
            confidence: 0.5,
            supportCount: score > 0 ? 1 : 0,
            contradictionCount: score < 0 ? 1 : 0,
            mentionCount: 1,
            relevance: 'proxy',
            reason: `Directly mentioned in news with ${score > 0 ? 'positive' : 'negative'} sentiment`,
            scenarioIds: [],
          });
        } else if (assetMap.get(key)!.relevance === 'direct') {
          // Update existing asset with better reasoning from news
          const existing = assetMap.get(key)!;
          existing.impactScore = (existing.impactScore + score) / 2;
          existing.reason = `${existing.reason} + Sentiment from news`;
        }
      });
    });

    // Convert to array and sort by relevance and impact
    return Array.from(assetMap.values())
      .map(item => ({
        ...item,
        // Boost confidence for assets with multiple supports
        confidence: item.relevance === 'direct' ? Math.min(1, item.confidence + 0.1) : item.confidence,
      }))
      .sort((a, b) => {
        // Sort by relevance: direct > related > proxy
        const relevanceOrder = { direct: 0, related: 1, proxy: 2 };
        if (relevanceOrder[a.relevance] !== relevanceOrder[b.relevance]) {
          return relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
        }
        // Then by impact score
        return Math.abs(b.impactScore) - Math.abs(a.impactScore);
      });
  }, [activeNews, scenarios]);

  const isInWatchlist = (asset: string) => watchlist.has(asset.toLowerCase());

  const toggleWatchlist = (asset: string) => {
    setWatchlist(prev => {
      const newSet = new Set(prev);
      const key = asset.toLowerCase();
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getRelevanceColor = (relevance: 'direct' | 'related' | 'proxy') => {
    if (relevance === 'direct') return isLightTheme
      ? 'bg-blue-100 text-blue-700 border-blue-300'
      : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (relevance === 'related') return isLightTheme
      ? 'bg-purple-100 text-purple-700 border-purple-300'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    return isLightTheme
      ? 'bg-slate-100 text-slate-600 border-slate-300'
      : 'bg-slate-700 text-slate-400 border-slate-600';
  };

  const getCardStyles = (direction: 'bullish' | 'bearish' | 'neutral', relevance: string) => {
    if (direction === 'bullish') {
      if (relevance === 'direct') return isLightTheme
        ? 'bg-emerald-50 border-emerald-300'
        : 'bg-emerald-100/50 border-emerald-500/50';
      if (relevance === 'related') return isLightTheme
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-emerald-500/30 border-emerald-500/40';
      return isLightTheme
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-emerald-500/20 border-emerald-500/30';
    }

    if (direction === 'bearish') {
      if (relevance === 'direct') return isLightTheme
        ? 'bg-rose-50 border-rose-300'
        : 'bg-rose-100/50 border-rose-500/50';
      if (relevance === 'related') return isLightTheme
        ? 'bg-rose-50 border-rose-200'
        : 'bg-rose-500/30 border-rose-500/40';
      return isLightTheme
        ? 'bg-rose-50 border-rose-200'
        : 'bg-rose-500/20 border-rose-500/30';
    }

    return isLightTheme
      ? 'bg-slate-50 border-slate-200'
      : 'bg-slate-800/50 border-slate-700/50';
  };

  if (watchlistItems.length === 0) {
    return (
      <div className={`text-center ${isLight ? 'text-slate-500' : 'text-slate-400'} py-8`}>
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No watchlist candidates yet.</p>
        <p className="text-xs mt-1">Generate scenarios to see relevant assets.</p>
      </div>
    );
  }

  const directItems = watchlistItems.filter(item => item.relevance === 'direct');
  const relatedItems = watchlistItems.filter(item => item.relevance === 'related');
  const proxyItems = watchlistItems.filter(item => item.relevance === 'proxy');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Watchlist</h3>
        <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {watchlistItems.length} items
        </span>
      </div>

      {/* Direct Assets Section */}
      {directItems.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider flex items-center gap-1`}>
            <Target className="w-3 h-3" />
            Directly Affected
          </div>
          {directItems.map(item => {
            const inWatchlist = isInWatchlist(item.asset);
            return (
              <div
                key={item.asset}
                className={`p-3 rounded-lg border transition-all ${getCardStyles(item.direction, item.relevance)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => toggleWatchlist(item.asset)}
                      className={`p-1 rounded ${isLight ? 'hover:bg-white/50' : 'hover:bg-slate-700/50'}`}
                    >
                      {inWatchlist ? (
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {item.asset}
                      </span>
                      {item.relevance !== 'direct' && (
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.relevance} instrument
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      item.direction === 'bullish' ? 'text-emerald-600' :
                      item.direction === 'bearish' ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {item.impactScore > 0 ? '+' : ''}{item.impactScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    <TrendingUp className="w-3 h-3" />
                    {item.supportCount}
                  </span>
                  <span className={`flex items-center gap-1 ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    <TrendingDown className="w-3 h-3" />
                    {item.contradictionCount}
                  </span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    Conf: {Math.round(item.confidence * 100)}%
                  </span>
                </div>

                <div className={`flex items-center gap-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span className={`px-1.5 py-0.5 rounded ${getRelevanceColor('direct')}`}>
                    Direct
                  </span>
                  <span>{item.reason}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Related Assets Section */}
      {relatedItems.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider flex items-center gap-1`}>
            <Target className="w-3 h-3" />
            Related Sector
          </div>
          {relatedItems.map(item => {
            const inWatchlist = isInWatchlist(item.asset);
            return (
              <div
                key={item.asset}
                className={`p-3 rounded-lg border transition-all ${getCardStyles(item.direction, item.relevance)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWatchlist(item.asset)}
                      className={`p-1 rounded ${isLight ? 'hover:bg-white/50' : 'hover:bg-slate-700/50'}`}
                    >
                      {inWatchlist ? (
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {item.asset}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRelevanceColor(item.relevance)}`}>
                      Related
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      item.direction === 'bullish' ? 'text-emerald-600' :
                      item.direction === 'bearish' ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {item.impactScore > 0 ? '+' : ''}{item.impactScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    <TrendingUp className="w-3 h-3" />
                    {item.supportCount}
                  </span>
                  <span className={`flex items-center gap-1 ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    <TrendingDown className="w-3 h-3" />
                    {item.contradictionCount}
                  </span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    Conf: {Math.round(item.confidence * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Proxy Assets Section */}
      {proxyItems.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider flex items-center gap-1`}>
            <Target className="w-3 h-3" />
            Proxy Instruments
          </div>
          {proxyItems.map(item => {
            const inWatchlist = isInWatchlist(item.asset);
            return (
              <div
                key={item.asset}
                className={`p-3 rounded-lg border transition-all ${getCardStyles(item.direction, item.relevance)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWatchlist(item.asset)}
                      className={`p-1 rounded ${isLight ? 'hover:bg-white/50' : 'hover:bg-slate-700/50'}`}
                    >
                      {inWatchlist ? (
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {item.asset}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRelevanceColor(item.relevance)}`}>
                      Proxy
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      item.direction === 'bullish' ? 'text-emerald-600' :
                      item.direction === 'bearish' ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {item.impactScore > 0 ? '+' : ''}{item.impactScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    <TrendingUp className="w-3 h-3" />
                    {item.supportCount}
                  </span>
                  <span className={`flex items-center gap-1 ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    <TrendingDown className="w-3 h-3" />
                    {item.contradictionCount}
                  </span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    Conf: {Math.round(item.confidence * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
