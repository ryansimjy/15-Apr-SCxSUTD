import { GoogleGenAI } from '@google/genai';
import { Scenario, LensHistoryItem, SentimentItem } from './types';

export interface LLMConfig {
  provider: 'gemini' | 'ollama';
  geminiKey?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

// Default Ollama configuration for local LLM inference
export const DEFAULT_OLLAMA_CONFIG = {
  url: 'http://localhost:11434',
  model: 'qwen3.5:35b',
};

export async function generateScenarios(
  config: LLMConfig,
  activeLens: LensHistoryItem | undefined,
  activeNews: SentimentItem[]
): Promise<Scenario[]> {
  if (!activeLens || activeNews.length === 0) return [];

  const generationTimestamp = Date.now();

  const prompt = `You are a senior market analyst generating scenario chains for a trading dashboard.
Generate up to 3 scenario cards based on the headlines below.
Return ONLY valid JSON with this exact structure:

{
  "selected_scenarios": [
    {
      "scenario_id": "string - use format like scenario_1, scenario_2",
      "title": "string - clear and specific, e.g., 'AI Policy Push Supports Tech Supply Chain'",
      "lifecycle_state": "string: initializing | growing | mature | weakening | contradictory | archived",
      "dominant_lens": "string - the lens category used",
      "importance_rank": number - integer from 1 to 3,
      "trigger_reason": "string - brief event description",
      "core_thesis": "string - 1-2 sentences on what's happening and why it matters",
      "supporting_headlines": ["string", ...],
      "contradictory_headlines": ["string", ...],
      "affected_assets": [
        {
          "asset": "string - specific asset name or ticker",
          "direction": "string: bullish | bearish | mixed",
          "net_direction_score": number - decimal between -1 and 1,
          "confidence": number - decimal between 0 and 1,
          "support_count": number - integer,
          "contradiction_count": number - integer,
          "reasoning": "string - brief explanation"
        }
      ],
      "conventional": {
        "summary": "string - brief summary of base case logic",
        "chain": ["string", "string", "string", "string"] - 3-5 cause-effect steps
      },
      "what_if_else": {
        "summary": "string - brief summary of alternate case",
        "rebuttal_condition": "string - condition for alternate scenario",
        "alternate_chain": ["string", "string", "string", "string"] - 3-4 steps
      },
      "confirmation_signals": ["string", "string", "string", "string"] - 2-4 items,
      "invalidation_signals": ["string", "string", "string", "string"] - 2-4 items,
      "confidence_score": number - decimal between 0 and 1,
      "timestamp": number - Unix timestamp,
      "generation_time": number - Unix timestamp
    }
  ]
}

IMPORTANT RULES:
1. confidence_score MUST be a decimal between 0 and 1 (e.g., 0.75, not 75)
2. Each scenario must have at least 1 affected asset
3. The chain arrays should have 3-5 short steps each
4. Do NOT include markdown code blocks
5. Return ONLY the JSON object, no explanations

Active Lens: ${activeLens.name} - ${activeLens.description}
Recent Headlines:
${activeNews.slice(0, 30).map(n => `- ${n.headline} (Lens: ${n.lens_used || 'None'})`).join('\n')}

Generate scenarios that are logically connected to these headlines.
`;

  try {
    let jsonStr = '';

    if (config.provider === 'gemini') {
      if (!config.geminiKey) throw new Error("Gemini API key is required");
      const ai = new GoogleGenAI({ apiKey: config.geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      jsonStr = response.text || '{}';
    } else {
      // Use default Ollama config if not provided
      const ollamaUrl = config.ollamaUrl || DEFAULT_OLLAMA_CONFIG.url;
      const ollamaModel = config.ollamaModel || DEFAULT_OLLAMA_CONFIG.model;
      
      if (!ollamaUrl || !ollamaModel) throw new Error("Ollama URL and Model are required");
      
      console.log(`Using Ollama: ${ollamaUrl} with model ${ollamaModel}`);
      
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          format: 'json',
          stream: false
        })
      });
      if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
      const data = await res.json();
      jsonStr = data.response || '';
      
      console.log('Ollama response received:', jsonStr.substring(0, 200) + '...');
    }

    // Clean up markdown json blocks if present
    jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

    // Validate JSON structure
    if (!jsonStr || jsonStr.trim() === '') {
      console.error("Empty response from LLM");
      throw new Error("Empty response from LLM");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw response:", jsonStr.substring(0, 1000));
      throw new Error(`Failed to parse JSON response. Details in console.`);
    }

    if (!parsed.selected_scenarios || !Array.isArray(parsed.selected_scenarios)) {
      console.error("Invalid response structure:", parsed);
      console.error("Expected: { selected_scenarios: [...] }");
      throw new Error("Invalid response format: missing selected_scenarios array");
    }

    // Normalize and ensure each scenario has a generation_time
    const scenariosWithTime = parsed.selected_scenarios.map(scenario => {
      // Normalize confidence_score: if > 1, it's likely a percentage, convert to decimal
      let normalizedConfidence = scenario.confidence_score;
      if (scenario.confidence_score > 1) {
        normalizedConfidence = scenario.confidence_score / 100;
        console.warn(`Normalized confidence_score from ${scenario.confidence_score} to ${normalizedConfidence}`);
      }

      // Also normalize asset confidence values
      const normalizedAssets = scenario.affected_assets?.map(asset => {
        if (asset.confidence > 1) {
          console.warn(`Normalized asset confidence from ${asset.confidence} to ${asset.confidence / 100}`);
          return { ...asset, confidence: asset.confidence / 100 };
        }
        return asset;
      }) || [];

      return {
        ...scenario,
        confidence_score: Math.max(0, Math.min(1, normalizedConfidence)), // Clamp between 0 and 1
        generation_time: scenario.generation_time || generationTimestamp,
        affected_assets: normalizedAssets
      };
    });

    // Log the actual values for debugging
    console.log('Scenarios returned with confidence_scores:', scenariosWithTime.map(s => s.confidence_score));

    return scenariosWithTime;
  } catch (error) {
    console.error("LLM Generation Error:", error);
    throw error;
  }
}
