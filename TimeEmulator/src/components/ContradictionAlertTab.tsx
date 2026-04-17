import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Scenario, AssetHeatmapItem } from '../types';

interface ContradictionAlertTabProps {
  theme: 'light' | 'dark';
  scenarios: Scenario[];
}

export const ContradictionAlertTab: React.FC<ContradictionAlertTabProps> = ({ theme, scenarios }) => {
  const isLight = theme === 'light';

  // Find contradictory scenarios (those with low confidence and high contradiction counts)
  const contradictionScenarios = useMemo(() => {
    return scenarios
      .map(scenario => {
        const contradictoryAssets = scenario.affected_assets.filter(a => a.contradiction_count > 0);
        const supportAssets = scenario.affected_assets.filter(a => a.support_count > 0);

        if (contradictoryAssets.length === 0) return null;

        // Calculate contradiction score
        const totalContradiction = contradictoryAssets.reduce((sum, a) => sum + a.contradiction_count, 0);
        const totalSupport = supportAssets.reduce((sum, a) => sum + a.support_count, 0);
        const contradictionScore = totalContradiction > 0 ? totalContradiction / (totalContradiction + totalSupport) : 0;

        return {
          ...scenario,
          contradictionScore,
          contradictoryAssets,
          supportAssets,
        };
      })
      .filter((s): s is (typeof scenarios)[number] & { contradictionScore: number; contradictoryAssets: any[]; supportAssets: any[] } => s !== null);
  }, [scenarios]);

  const findContradictoryPairs = () => {
    const pairs: {
      scenario1: Scenario;
      scenario2: Scenario;
      assets: string[];
      reasoning: string;
    }[] = [];

    for (let i = 0; i < scenarios.length; i++) {
      for (let j = i + 1; j < scenarios.length; j++) {
        const s1 = scenarios[i];
        const s2 = scenarios[j];

        // Check if scenarios contradict each other
        const conflictingAssets = [];
        s1.affected_assets.forEach(asset1 => {
          s2.affected_assets.forEach(asset2 => {
            if (asset1.asset === asset2.asset) {
              const direction1 = asset1.direction === 'bullish' ? 1 : asset1.direction === 'bearish' ? -1 : 0;
              const direction2 = asset2.direction === 'bullish' ? 1 : asset2.direction === 'bearish' ? -1 : 0;

              if (direction1 !== direction2 && direction1 !== 0 && direction2 !== 0) {
                conflictingAssets.push(asset1.asset);
              }
            }
          });
        });

        if (conflictingAssets.length > 0) {
          pairs.push({
            scenario1: s1,
            scenario2: s2,
            assets: conflictingAssets,
            reasoning: `Scenario "${s1.title}" expects ${conflictingAssets[0]} to go ${s1.affected_assets.find(a => a.asset === conflictingAssets[0])?.direction}, but "${s2.title}" expects opposite movement.`,
          });
        }
      }
    }

    return pairs;
  };

  const contradictionPairs = findContradictoryPairs();

  if (scenarios.length === 0) {
    return (
      <div className={`text-center ${isLight ? 'text-slate-500' : 'text-slate-400'} py-8`}>
        No scenarios generated yet. Contradiction alerts will appear here.
      </div>
    );
  }

  const highContradictionScenarios = contradictionScenarios
    .filter(s => s.contradictionScore > 0.3)
    .sort((a, b) => b.contradictionScore - a.contradictionScore);

  const conflictingAssetsMap = new Map<string, number>();
  contradictionPairs.forEach(pair => {
    pair.assets.forEach(asset => {
      conflictingAssetsMap.set(asset, (conflictingAssetsMap.get(asset) || 0) + 1);
    });
  });

  const mostConflictedAssets = Array.from(conflictingAssetsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-5 h-5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
        <h2 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Contradiction Alerts</h2>
      </div>

      {/* High Contradiction Scenarios */}
      {highContradictionScenarios.length > 0 && (
        <div className={`p-4 rounded-lg border ${isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className={`text-sm font-medium ${isLight ? 'text-amber-800' : 'text-amber-300'} mb-2`}>
            {highContradictionScenarios.length} scenario(s) with high internal contradiction
          </div>
          <div className="space-y-2">
            {highContradictionScenarios.slice(0, 3).map(scenario => (
              <div
                key={scenario.scenario_id}
                className={`p-3 rounded-lg ${isLight ? 'bg-white/50' : 'bg-slate-800/50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                    {scenario.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300'}`}>
                    {Math.round(scenario.contradictionScore * 100)}% contradict
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {scenario.supporting_headlines.length} support
                  </span>
                  <span className={`${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    <TrendingDown className="w-3 h-3 inline mr-1" />
                    {scenario.contradictory_headlines.length} contradict
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicting Scenario Pairs */}
      {contradictionPairs.length > 0 && (
        <div className={`p-4 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-slate-800/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Conflicting Scenarios</h3>
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {contradictionPairs.length} pairs found
            </span>
          </div>

          <div className="space-y-2">
            {contradictionPairs.slice(0, 3).map((pair, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${isLight ? 'bg-white/50 border border-slate-200' : 'bg-slate-800/50 border border-slate-700/50'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <X className={`w-4 h-4 ${isLight ? 'text-rose-500' : 'text-rose-400'}`} />
                  <span className={`text-xs ${isLight ? 'text-rose-600' : 'text-rose-400'} font-medium`}>
                    {pair.assets.join(', ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-2 rounded ${isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                    <div className={`font-medium ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                      {pair.scenario1.title}
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {pair.scenario1.core_thesis.substring(0, 60)}...
                    </div>
                  </div>
                  <div className={`p-2 rounded ${isLight ? 'bg-rose-50' : 'bg-rose-500/10'}`}>
                    <div className={`font-medium ${isLight ? 'text-rose-800' : 'text-rose-300'}`}>
                      {pair.scenario2.title}
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                      {pair.scenario2.core_thesis.substring(0, 60)}...
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Conflicted Assets */}
      {mostConflictedAssets.length > 0 && (
        <div className={`p-4 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-slate-800/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
            <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Most Conflicted Assets</h3>
          </div>
          <div className="space-y-2">
            {mostConflictedAssets.map(([asset, count]) => (
              <div key={asset} className="flex items-center justify-between">
                <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{asset}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300'}`}>
                  {count} conflict(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={`p-3 rounded-lg ${isLight ? 'bg-blue-50 border border-blue-100' : 'bg-blue-500/10 border border-blue-500/30'}`}>
        <div className={`text-sm ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
          {contradictionPairs.length === 0 && highContradictionScenarios.length === 0 ? (
            <>No contradictions detected. All scenarios are internally consistent.</>
          ) : (
            <>
              <strong>Recommendation:</strong> Review scenarios with high contradiction scores. Consider
              refining thesis or gathering more supporting evidence.
            </>
          )}
        </div>
      </div>
    </div>
  );
};
