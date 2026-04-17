export type SentimentScores = Record<string, number>;

export interface SentimentItem {
  id: string;
  scores: SentimentScores;
  lens_scores: SentimentScores;
  reasoning: Record<string, string>;
  lens_fit: Record<string, string>;
  headline: string;
  lens_used: string;
  timestamp: number;
}

export interface LensHistoryItem {
  timestamp: number;
  name: string;
  description: string;
  reason: string;
  dt_str: string;
}

export interface AffectedAsset {
  asset: string;
  direction: 'bullish' | 'bearish' | 'mixed';
  net_direction_score: number;
  confidence: number;
  support_count: number;
  contradiction_count: number;
  reasoning: string;
}

export interface Scenario {
  scenario_id: string;
  title: string;
  lifecycle_state: 'initializing' | 'growing' | 'mature' | 'weakening' | 'contradictory' | 'archived';
  dominant_lens: string;
  importance_rank: number;
  trigger_reason: string;
  core_thesis: string;
  supporting_headlines: string[];
  contradictory_headlines: string[];
  affected_assets: AffectedAsset[];
  conventional: {
    summary: string;
    chain: string[];
  };
  what_if_else: {
    summary: string;
    rebuttal_condition: string;
    alternate_chain: string[];
  };
  confirmation_signals: string[];
  invalidation_signals: string[];
  confidence_score: number;
  timestamp: number;
  generation_time: number;
}

export interface AssetHeatmapItem extends AffectedAsset {
  scenario_id: string;
  scenario_title: string;
}

// === Relationship Graph Types ===
export type NodeType = 'headline' | 'scenario' | 'asset' | 'topic' | 'entity' | 'claim' | 'confirmation' | 'invalidation';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  metadata?: Record<string, any>;
  data?: any;
}

export type EdgeType = 'mentions' | 'affects' | 'supports' | 'invalidates' | 'related-to' | 'confirmed-by' | 'invalidated-by';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  description?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphPosition {
  x: number;
  y: number;
}

// Theme types
export type Theme = 'dark' | 'light';
