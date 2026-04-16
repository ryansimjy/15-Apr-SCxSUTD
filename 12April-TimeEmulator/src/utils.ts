import { SentimentItem, LensHistoryItem, Scenario } from './types';

export const parseLensHistory = (jsonl: string): LensHistoryItem[] => {
  return jsonl
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const parsed = JSON.parse(line);
      return {
        ...parsed,
        timestamp: parsed.timestamp * 1000, // Convert to ms
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
};

export const parseSentimentCache = (json: any, startTime: number, endTime: number): SentimentItem[] => {
  const items: SentimentItem[] = [];
  const keys = Object.keys(json);
  
  // If no timestamp is provided in the sentiment cache, we simulate one
  // by distributing them evenly across the time range for demonstration.
  const timeStep = (endTime - startTime) / (keys.length + 1);

  keys.forEach((key, index) => {
    const item = json[key];
    items.push({
      id: key,
      ...item,
      timestamp: item.timestamp ? item.timestamp * 1000 : startTime + timeStep * (index + 1),
    });
  });

  return items.sort((a, b) => a.timestamp - b.timestamp);
};

export const formatTime = (timestamp: number) => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
};

// Mock Scenario Generator to simulate the LLM backend
export const generateMockScenarios = (activeLens: LensHistoryItem | undefined, activeNews: SentimentItem[]): Scenario[] => {
  if (!activeLens || activeNews.length === 0) return [];

  // Group news by lens_used to find relevant headlines
  const relevantNews = activeNews.filter(n => n.lens_used === activeLens.name || !n.lens_used);
  if (relevantNews.length === 0) return [];

  return [
    {
      scenario_id: `sc_${activeLens.timestamp}`,
      title: activeLens.name === "CPI Data Integrity Concerns"
        ? "Data Uncertainty Drives Risk-Off Repricing"
        : activeLens.name,
      lifecycle_state: "growing",
      dominant_lens: activeLens.name,
      importance_rank: 1,
      trigger_reason: activeLens.reason || "Recent headline clusters indicate a shift in market focus.",
      core_thesis: activeLens.description || "The market is repricing risk based on new uncertainties.",
      supporting_headlines: relevantNews.map(n => n.headline).slice(0, 3),
      contradictory_headlines: [],
      affected_assets: [
        {
          asset: "S&P 500",
          direction: "bearish",
          net_direction_score: -0.45,
          confidence: 0.8,
          support_count: relevantNews.length,
          contradiction_count: 0,
          reasoning: "Uncertainty reduces clarity, affecting earnings forecasts and overall valuation."
        },
        {
          asset: "Gold",
          direction: "bullish",
          net_direction_score: 0.6,
          confidence: 0.75,
          support_count: relevantNews.length,
          contradiction_count: 0,
          reasoning: "A higher risk premium due to data issues drives demand for safe havens."
        }
      ],
      conventional: {
        summary: "Market derisks amid uncertainty, favoring havens.",
        chain: [
          "Uncertainty emerges around key data or geopolitical events.",
          "Market interprets this as a risk to terminal rate clarity.",
          "Equities sell off while Gold and Bonds catch a bid.",
          "Volatility remains elevated until clarity is restored."
        ]
      },
      what_if_else: {
        summary: "Data is validated or tensions ease, reversing the haven bid.",
        rebuttal_condition: "If subsequent reports confirm data integrity or de-escalate tensions.",
        alternate_chain: [
          "Market realizes the risk was overstated.",
          "Safe haven premiums collapse rapidly.",
          "Equities gap higher on short covering.",
          "Focus returns to baseline macro fundamentals."
        ]
      },
      confirmation_signals: [
        "Further official statements questioning data",
        "VIX spiking above 20"
      ],
      invalidation_signals: [
        "Clear, undisputed data releases",
        "Coordinated central bank reassurance"
      ],
      confidence_score: 0.82,
      timestamp: activeLens.timestamp,
      generation_time: Date.now()
    }
  ];
};
