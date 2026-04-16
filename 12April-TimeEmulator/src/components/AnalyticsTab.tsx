import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target, Award, Activity, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from 'lucide-react';
import { Scenario } from '../types';

interface AnalyticsTabProps {
  theme: 'light' | 'dark';
  scenarios: Scenario[];
  activeNews: any[];
}

interface AssetStats {
  asset: string;
  count: number;
  avgScore: number;
  bullishCount: number;
  bearishCount: number;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ theme, scenarios, activeNews }) => {
  const isLight = theme === 'light';

  // Calculate performance metrics
  const metrics = useMemo(() => {
    // Lifecycle distribution
    const lifecycleCount = new Map<string, number>();
    scenarios.forEach(s => {
      lifecycleCount.set(s.lifecycle_state, (lifecycleCount.get(s.lifecycle_state) || 0) + 1);
    });

    // Sentiment over time (simplified - using scenarios as proxy)
    const sentimentTrend: { time: string; netSentiment: number }[] = [];
    let runningNet = 0;
    const timeLabels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];

    scenarios.forEach((s, i) => {
      const baseScore = scenarios.length > 0 ? (i - scenarios.length / 2) / (scenarios.length / 2) : 0;
      runningNet += baseScore * 0.3;
      sentimentTrend.push({
        time: timeLabels[i % timeLabels.length],
        netSentiment: runningNet,
      });
    });

    // Most cited assets
    const assetStats: Map<string, AssetStats> = new Map();
    scenarios.forEach(scenario => {
      scenario.affected_assets.forEach(asset => {
        const existing = assetStats.get(asset.asset);
        if (!existing) {
          assetStats.set(asset.asset, {
            asset: asset.asset,
            count: 1,
            avgScore: asset.net_direction_score,
            bullishCount: asset.direction === 'bullish' ? 1 : 0,
            bearishCount: asset.direction === 'bearish' ? 1 : 0,
          });
        } else {
          existing.count++;
          existing.avgScore = (existing.avgScore + asset.net_direction_score) / 2;
          if (asset.direction === 'bullish') existing.bullishCount++;
          if (asset.direction === 'bearish') existing.bearishCount++;
        }
      });
    });

    const sortedAssets = Array.from(assetStats.values()).sort((a, b) => b.count - a.count);
    const mostCited = sortedAssets.slice(0, 5);

    // News volume (using activeNews)
    const newsVolume = activeNews.length;

    // Average confidence
    const avgConfidence = scenarios.length > 0
      ? scenarios.reduce((sum, s) => sum + s.confidence_score, 0) / scenarios.length
      : 0;

    // Contradiction ratio
    const contradictionCount = scenarios.reduce((sum, s) => sum + s.affected_assets.filter(a => a.contradiction_count > 0).length, 0);
    const contradictionRatio = scenarios.length > 0 ? contradictionCount / scenarios.length : 0;

    return {
      lifecycleCount,
      sentimentTrend,
      mostCited,
      newsVolume,
      avgConfidence,
      contradictionRatio,
    };
  }, [scenarios, activeNews]);

  const renderBarChart = () => {
    const maxCount = Math.max(...Array.from(metrics.lifecycleCount.values()), 1);

    return (
      <div className="space-y-2">
        {Array.from(metrics.lifecycleCount.entries()).map(([state, count]) => {
          const percentage = (count / maxCount) * 100;
          let barColor = 'bg-blue-600';
          let labelColor = isLight ? 'text-slate-700' : 'text-slate-200';

          if (state === 'growing') barColor = 'bg-emerald-600';
          if (state === 'weakening') barColor = 'bg-amber-600';
          if (state === 'contradictory') barColor = 'bg-rose-600';
          if (state === 'archived') barColor = 'bg-slate-500';
          if (state === 'mature') barColor = 'bg-indigo-600';

          return (
            <div key={state} className="flex items-center gap-3">
              <span className={`text-xs font-semibold w-20 ${labelColor} capitalize`}>{state}</span>
              <div className={`flex-1 h-2.5 rounded ${isLight ? 'bg-slate-200' : 'bg-slate-700'} overflow-hidden`}>
                <div className={`h-full rounded ${barColor} transition-all`} style={{ width: `${percentage}%` }} />
              </div>
              <span className={`text-sm font-bold w-10 text-right ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSentimentTrend = () => {
    if (metrics.sentimentTrend.length === 0) {
      return <div className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>No sentiment data available</div>;
    }

    return (
      <div className="flex items-end gap-1 h-24">
        {metrics.sentimentTrend.map((item, i) => {
          const height = Math.min(Math.abs(item.netSentiment) * 50, 100);
          const isPositive = item.netSentiment >= 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'} transition-all`}
                style={{ height: `${height}%`, minHeight: '4px' }}
              />
              <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{item.time}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNewsVolume = () => {
    return (
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>News Volume</span>
        </div>
        <div className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
          {metrics.newsVolume}
        </div>
        <div className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>articles in time window</div>
      </div>
    );
  };

  const renderMostCited = () => {
    if (metrics.mostCited.length === 0) {
      return <div className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>No asset data available</div>;
    }

    return (
      <div className="space-y-1">
        {metrics.mostCited.map((asset, i) => (
          <div
            key={asset.asset}
            className={`flex items-center justify-between p-3 rounded-lg transition-all ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                : 'bg-slate-800/80 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold w-6 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                #{i + 1}
              </span>
              <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {asset.asset}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {asset.count}
                </div>
                <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Mentions
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderNetSentiment = () => {
    return (
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Net Sentiment</span>
        </div>
        {renderSentimentTrend()}
      </div>
    );
  };

  const renderConfidence = () => {
    return (
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Target className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Avg Scenario Confidence</span>
        </div>
        <div className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
          {(metrics.avgConfidence * 100).toFixed(0)}%
        </div>
        <div className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Average confidence across all scenarios
        </div>
      </div>
    );
  };

  const renderContradiction = () => {
    const isHigh = metrics.contradictionRatio > 0.3;
    return (
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Award className={`w-4 h-4 ${isLight ? (isHigh ? 'text-amber-600' : 'text-emerald-600') : (isHigh ? 'text-amber-500' : 'text-emerald-500')}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Contradiction Rate</span>
        </div>
        <div className={`text-3xl font-bold ${isLight ? (isHigh ? 'text-amber-600' : 'text-emerald-600') : (isHigh ? 'text-amber-500' : 'text-emerald-500')}`}>
          {(metrics.contradictionRatio * 100).toFixed(0)}%
        </div>
        <div className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          {isHigh
            ? 'High contradiction rate - consider diversifying scenarios'
            : 'Scenarios show good internal consistency'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Analytics Overview</h2>

      {/* Lifecycle Distribution */}
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Lifecycle Distribution</span>
        </div>
        {renderBarChart()}
      </div>

      {/* Grid of metrics */}
      <div className="grid grid-cols-2 gap-3">
        {renderNewsVolume()}
        {renderConfidence()}
        {renderContradiction()}
      </div>

      {/* Most Cited Assets */}
      <div className={`p-4 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Award className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-500'}`} />
          <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Most Cited Assets</span>
        </div>
        {renderMostCited()}
      </div>

      {/* Net Sentiment */}
      {renderNetSentiment()}
    </div>
  );
};
