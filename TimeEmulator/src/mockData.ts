export const mockSentimentCache = {
  "e316b985283e53e6168801672888d614": {
    "scores": {
      "Nasdaq": 0.1,
      "Crypto Currency": 0.0,
      "S&P 500": 0.05,
      "US 10Y Bond": 0.0,
      "USD/JPY": 0.0,
      "Gold": 0.0
    },
    "lens_scores": {
      "Nasdaq": -0.020000000000000004,
      "S&P 500": -0.010000000000000002
    },
    "reasoning": {
      "Nasdaq": "This headline discusses a Chinese company completing a funding round for electric vehicle infrastructure, which could signal growth in the EV sector and indirectly impact Nasdaq-listed companies involved in similar or related industries.",
      "Crypto Currency": "This headline is about funding for EV infrastructure in China and is unlikely to have any direct impact on cryptocurrency prices.",
      "S&P 500": "This headline about funding for EV infrastructure in China is unlikely to have a significant direct impact on the S&P 500.",
      "US 10Y Bond": "This headline is about funding for EV infrastructure in China and is unlikely to have a direct impact on US 10Y bond yields.",
      "USD/JPY": "This headline is about funding for EV infrastructure in China and is unlikely to have a direct impact on the USD/JPY exchange rate.",
      "Gold": "This headline is about funding for EV infrastructure in China and is unlikely to have a direct impact on gold prices."
    },
    "lens_fit": {
      "Nasdaq": "Uncertainty in Chinese EV infrastructure growth translates to risk for Nasdaq-listed competitors.",
      "Crypto Currency": "No link.",
      "S&P 500": "Uncertainty impacting companies with China EV exposure.",
      "US 10Y Bond": "No link.",
      "USD/JPY": "No link.",
      "Gold": "No link."
    },
    "headline": "Zhi Li Wu Lian Completes 100 Million RMB B Round Financing",
    "lens_used": "CPI Data Integrity Concerns"
  },
  "26ffb5cdde8dee11a7a87351372f1264": {
    "scores": {
      "S&P 500": -0.5,
      "Nasdaq": -0.6,
      "US 10Y Bond": -0.3,
      "USD/JPY": -0.2,
      "Gold": 0.4
    },
    "lens_scores": {
      "Nasdaq": -0.48,
      "S&P 500": -0.42,
      "US 10Y Bond": -0.25,
      "USD/JPY": -0.12,
      "Gold": 0.42
    },
    "reasoning": {
      "S&P 500": "If the CPI data integrity is questioned, the market might become risk-averse due to the uncertainty surrounding the Federal Reserve's monetary policy, potentially causing the S&P 500 to decline.",
      "Nasdaq": "If CPI data is unreliable, it will increase uncertainty about interest rate decisions, making growth stocks in the Nasdaq less attractive and likely causing its price to decline.",
      "US 10Y Bond": "If CPI data is viewed as unreliable, the true inflation picture will be less clear, leading to potential volatility in bond yields as investors reassess the risk premium, potentially pushing bond prices down.",
      "USD/JPY": "Concerns over CPI data integrity might trigger risk aversion, potentially leading investors to seek safe-haven currencies like the JPY, causing USD/JPY to decline.",
      "Gold": "Doubts about CPI accuracy could lead investors to seek hedges against inflation, potentially increasing demand for gold and driving its price up."
    },
    "lens_fit": {
      "S&P 500": "Data uncertainty reduces clarity, affecting earnings forecasts and overall valuation.",
      "Nasdaq": "Higher sensitivity to rate changes means uncertainty is amplified in tech valuations.",
      "US 10Y Bond": "Bonds reprice constantly based on the CURRENT data picture.",
      "USD/JPY": "Risk off sentiment strengthens the JPY against the USD.",
      "Gold": "A higher risk premium due to data issues drives demand."
    },
    "headline": "Thailand and Cambodia expand delegation sizes for border security talks.",
    "lens_used": "CPI Data Integrity Concerns"
  }
};

export const mockLensHistory = `{"timestamp": 1766398984.117635, "name": "Global Growth Forecast Volatility", "description": "Markets are exhibiting sensitivity to a wide range of growth forecasts, as evidenced by headline density, diverse sources (Central Banks, Tier 1 media), and cross-asset reactions. IF growth forecasts are revised downwards, THEN risk assets will likely suffer, with investors seeking safe havens like Gold. The market struggles to assess terminal rates in light of a slowing growth picture.", "reason": "System Initialization (Manual Force Log)", "dt_str": "2025-12-22 18:23:04"}
{"timestamp": 1766399012.884185, "name": "Geopolitical Instability & AI Development", "description": "Focus on escalating tensions in the Middle East and the rapid advancements in AI, particularly within enterprise applications. Analyze the potential market impacts of both geopolitical risks and technological disruption.", "reason": "Market focus shifting due to rising geopolitical tensions and advancements in enterprise AI.", "dt_str": "2025-12-22 18:23:32"}
{"timestamp": 1766400981.5764782, "name": "Fiscal Policy & Yen Intervention", "description": "Focus on the interplay between Japanese fiscal policy, specifically the upcoming budget, and potential interventions in the currency market. Analyze how government spending and debt management influence the Yen's value and the effectiveness of intervention strategies.", "reason": "Market focus shifting to Japan's fiscal policy and its impact on the Yen, driven by concerns over budget deficits and potential currency intervention.", "dt_str": "2025-12-22 18:56:21"}`;
