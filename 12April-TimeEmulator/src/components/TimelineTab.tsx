import React from 'react';
import { Clock } from 'lucide-react';
import { SentimentItem, formatTime } from '../utils';

interface TimelineTabProps {
  theme: 'light' | 'dark';
  activeNews: SentimentItem[];
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ theme, activeNews }) => {
  const isLight = theme === 'light';

  if (activeNews.length === 0) {
    return (
      <div className={`text-center ${isLight ? 'text-slate-500' : 'text-slate-400'} py-8`}>
        No news data available for this time period.
      </div>
    );
  }

  // Sort by timestamp (oldest first)
  const sortedNews = [...activeNews].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-3">
      <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>News Timeline</h3>
      {sortedNews.slice(0, 30).map((news, index) => (
        <div
          key={news.id}
          className={`flex gap-3 p-3 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800/50 border border-slate-700/50'}`}
        >
          <div className={`flex-shrink-0 w-12 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <div className="text-xs font-mono">{formatTime(news.timestamp).split(' ')[0]}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`} />
              <span className={`text-xs ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                {formatTime(news.timestamp)}
              </span>
              {news.lens_used && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'}`}>
                  {news.lens_used}
                </span>
              )}
            </div>
            <p className={`text-sm ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{news.headline}</p>
            <div className="flex gap-2 mt-1">
              {Object.entries(news.scores)
                .slice(0, 3)
                .map(([asset, score]) => (
                  <span
                    key={asset}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      score > 0
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-500/20 text-emerald-300'
                        : score < 0
                        ? isLight
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-rose-500/20 text-rose-300'
                        : isLight
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {asset}: {score > 0 ? '+' : ''}{score}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ))}
      {sortedNews.length > 30 && (
        <div className={`text-center text-xs py-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Showing 30 of {sortedNews.length} items
        </div>
      )}
    </div>
  );
};
