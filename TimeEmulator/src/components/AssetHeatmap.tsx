import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { Scenario } from '../types';

interface AssetHeatmapProps {
  theme: 'light' | 'dark';
  scenarios: Scenario[];
}

interface AggregatedAsset {
  asset: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  netDirectionScore: number;
  confidence: number;
  supportCount: number;
  contradictionCount: number;
  mentions: number;
  thesis: string;
  scenarioIds: Set<string>;
}

export const AssetHeatmap: React.FC<AssetHeatmapProps> = ({ theme, scenarios }) => {
  const isLight = theme === 'light';

  // Aggregate asset impact across all scenarios
  const assetImpact = useMemo(() => {
    const assetMap = new Map<string, AggregatedAsset>();

    scenarios.forEach(scenario => {
      scenario.affected_assets.forEach(asset => {
        const key = asset.asset.toLowerCase();
        const existing = assetMap.get(key);

        if (!existing) {
          assetMap.set(key, {
            asset: asset.asset,
            direction: asset.direction === 'mixed' ? 'neutral' : asset.direction,
            netDirectionScore: asset.net_direction_score,
            confidence: asset.confidence,
            supportCount: asset.support_count,
            contradictionCount: asset.contradiction_count,
            mentions: 1,
            thesis: asset.reasoning || generateThesis(asset),
            scenarioIds: new Set([scenario.scenario_id]),
          });
        } else {
          existing.netDirectionScore = (existing.netDirectionScore + asset.net_direction_score) / 2;
          existing.confidence = (existing.confidence + asset.confidence) / 2;
          existing.supportCount += asset.support_count;
          existing.contradictionCount += asset.contradiction_count;
          existing.mentions += 1;
          existing.scenarioIds.add(scenario.scenario_id);
          if (asset.reasoning && asset.reasoning.length > existing.thesis.length) {
            existing.thesis = asset.reasoning;
          }
        }
      });
    });

    return Array.from(assetMap.values())
      .sort((a, b) => Math.abs(b.netDirectionScore) - Math.abs(a.netDirectionScore));
  }, [scenarios]);

  const generateThesis = (asset: any): string => {
    if (asset.direction === 'bullish') {
      return `Positive catalyst from scenario context supporting ${asset.asset}`;
    }
    if (asset.direction === 'bearish') {
      return `Negative pressure from scenario context affecting ${asset.asset}`;
    }
    return `${asset.asset} shows mixed signals from scenario`;
  };

  const totalScenarios = scenarios.length;

  if (totalScenarios === 0) {
    return (
      <div className={`text-center py-8 font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
        No scenarios generated yet. Asset impact will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
          Asset Impact Heatmap
        </h3>
        <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
          {assetImpact.length} assets | {totalScenarios} scenarios
        </span>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {assetImpact.map(asset => {
          const isBullish = asset.direction === 'bullish';
          const isBearish = asset.direction === 'bearish';
          const absScore = Math.abs(asset.netDirectionScore);
          const strongImpact = absScore > 0.5;
          const moderateImpact = absScore > 0.25 && !strongImpact;

          return (
            <div
              className={`rounded-lg border transition-all hover:shadow-md ${
                isBullish && strongImpact
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500'
                  : isBullish && moderateImpact
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400'
                  : isBullish
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 border-emerald-300'
                  : isBearish && strongImpact
                  ? 'bg-gradient-to-br from-rose-600 to-rose-700 border-rose-500'
                  : isBearish && moderateImpact
                  ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400'
                  : isBearish
                  ? 'bg-gradient-to-br from-rose-400 to-rose-500 border-rose-300'
                  : 'bg-gradient-to-br from-slate-200 to-slate-300 border-slate-300'
              }`}
            >
              <div className="p-4">
                {/* Asset name and direction */}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm text-white tracking-tight">
                    {asset.asset}
                  </span>
                  <div className="flex items-center gap-1">
                    {isBullish ? (
                      <TrendingUp className="w-4 h-4 text-emerald-200" />
                    ) : isBearish ? (
                      <TrendingDown className="w-4 h-4 text-rose-200" />
                    ) : (
                      <Minus className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </div>

                {/* Impact score */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-bold text-white">
                    {asset.netDirectionScore > 0 ? '+' : ''}{asset.netDirectionScore.toFixed(2)}
                  </span>
                  <span className="text-xs font-medium text-white/90">
                    Impact Score
                  </span>
                </div>

                {/* Confidence and mentions */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-200" />
                    <span className="text-xs font-semibold text-white/95">
                      Conf: {Math.round(asset.confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-white/95">
                    {asset.mentions} mentions
                  </span>
                </div>

                {/* Support/Contradiction */}
                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className="flex items-center gap-1 text-emerald-100 font-semibold">
                    <TrendingUp className="w-3 h-3" />
                    {asset.supportCount} support
                  </span>
                  <span className="flex items-center gap-1 text-rose-100 font-semibold">
                    <TrendingDown className="w-3 h-3" />
                    {asset.contradictionCount} conflict
                  </span>
                </div>

                {/* Thesis */}
                {asset.thesis && (
                  <div className="pt-2 border-t border-white/20 mt-2">
                    <p className="text-xs text-white/90 italic leading-relaxed">
                      {asset.thesis}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className={`p-4 rounded-lg ${isLight ? 'bg-slate-100' : 'bg-slate-800/50'}`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-600">
              {assetImpact.filter(a => a.netDirectionScore > 0.2).length}
            </div>
            <div className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Bullish</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600">
              {assetImpact.filter(a => a.netDirectionScore < -0.2).length}
            </div>
            <div className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Bearish</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-700">
              {assetImpact.filter(a => Math.abs(a.netDirectionScore) <= 0.2).length}
            </div>
            <div className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Neutral</div>
          </div>
        </div>
      </div>
    </div>
  );
};
