import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomIn, ZoomOut, RefreshCw, Info } from 'lucide-react';
import { SentimentItem, Scenario, GraphNode, GraphEdge, NodeType, EdgeType } from '../types';

interface GraphTabProps {
  theme: 'light' | 'dark';
  activeNews: SentimentItem[];
  scenarios: Scenario[];
}

export const GraphTab: React.FC<GraphTabProps> = ({ theme, activeNews, scenarios }) => {
  const isLight = theme === 'light';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Generate graph data from news and scenarios
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let nodeId = 0;

    // Add headline nodes
    activeNews.slice(0, 10).forEach(news => {
      nodes.push({
        id: `H-${news.id}`,
        type: 'headline',
        label: news.headline.substring(0, 25) + (news.headline.length > 25 ? '...' : ''),
        description: news.headline,
      });
    });

    // Add scenario nodes
    scenarios.forEach(scenario => {
      nodes.push({
        id: `S-${scenario.scenario_id}`,
        type: 'scenario',
        label: scenario.title.substring(0, 20) + (scenario.title.length > 20 ? '...' : ''),
        description: scenario.core_thesis,
        metadata: {
          state: scenario.lifecycle_state,
          confidence: scenario.confidence_score,
        },
      });

      // Link to supporting headlines
      scenario.supporting_headlines.forEach((headline, i) => {
        const headlineNode = nodes.find(n => n.description === headline);
        if (headlineNode) {
          edges.push({
            id: `E-${nodeId++}`,
            source: headlineNode.id,
            target: `S-${scenario.scenario_id}`,
            type: 'supports',
            description: `Supports ${scenario.title}`,
          });
        }
      });
    });

    // Add asset nodes
    scenarios.forEach(scenario => {
      scenario.affected_assets.forEach(asset => {
        let assetType: 'asset' | 'topic' | 'entity' = 'asset';
        if (asset.asset.includes('crypto') || asset.asset.includes('BTC') || asset.asset.includes('ETH')) {
          assetType = 'topic';
        }

        nodes.push({
          id: `A-${asset.asset}`,
          type: assetType,
          label: asset.asset,
          metadata: {
            direction: asset.direction,
            score: asset.net_direction_score,
          },
        });

        edges.push({
          id: `E-${nodeId++}`,
          source: `S-${scenario.scenario_id}`,
          target: `A-${asset.asset}`,
          type: 'affects',
          description: `Affects ${asset.asset}`,
        });
      });
    });

    // Add topic nodes from lenses
    activeNews.slice(0, 5).forEach(news => {
      if (news.lens_used) {
        nodes.push({
          id: `L-${news.lens_used.replace(/\s/g, '-')}`,
          type: 'topic',
          label: news.lens_used,
        });

        edges.push({
          id: `E-${nodeId++}`,
          source: `H-${news.id}`,
          target: `L-${news.lens_used.replace(/\s/g, '-')}`,
          type: 'mentions',
        });
      }
    });

    return { nodes, edges };
  }, [activeNews, scenarios]);

  // Calculate node positions (force-directed layout approximation)
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const nodeGroups: Record<string, GraphNode[]> = {
      headline: [],
      scenario: [],
      asset: [],
      topic: [],
    };

    // Group nodes by type
    graphData.nodes.forEach(node => {
      if (nodeGroups[node.type]) {
        nodeGroups[node.type].push(node);
      } else {
        nodeGroups.topic.push(node);
      }
    });

    // Circular layout for each group
    Object.entries(nodeGroups).forEach(([groupType, nodesInGroup]) => {
      const centerX = (groupType === 'scenario' || groupType === 'topic') ? 0 : -150;
      const centerY = groupType === 'asset' ? 0 : 0;
      const radius = groupType === 'headline' ? 120 : groupType === 'scenario' ? 150 : groupType === 'topic' ? 180 : 140;
      const angleStep = (2 * Math.PI) / nodesInGroup.length;

      nodesInGroup.forEach((node, i) => {
        const angle = i * angleStep - Math.PI / 2;
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    });

    return positions;
  }, [graphData]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.min(Math.max(zoom - e.deltaY * 0.001, 0.5), 3);
    setZoom(newZoom);
  };

  const getNodeColor = (nodeType: NodeType, metadata?: any) => {
    if (nodeType === 'headline') return isLight ? '#8b5cf6' : '#a78bfa';
    if (nodeType === 'scenario') return isLight ? '#3b82f6' : '#60a5fa';
    if (nodeType === 'asset') {
      if (metadata?.direction === 'bullish') return isLight ? '#10b981' : '#34d399';
      if (metadata?.direction === 'bearish') return isLight ? '#f43f5e' : '#fb7185';
      return isLight ? '#f59e0b' : '#fbbf24';
    }
    if (nodeType === 'topic') return isLight ? '#06b6d4' : '#22d3ee';
    return isLight ? '#6b7280' : '#9ca3af';
  };

  const getNodeTypeColor = (nodeType: NodeType) => {
    switch (nodeType) {
      case 'headline': return isLight ? '#8b5cf6' : '#a78bfa';
      case 'scenario': return isLight ? '#3b82f6' : '#60a5fa';
      case 'asset': return isLight ? '#10b981' : '#34d399';
      default: return isLight ? '#06b6d4' : '#22d3ee';
    }
  };

  const getNodeLabelColor = (nodeType: NodeType) => {
    if (nodeType === 'asset') return isLight ? '#064e3b' : '#064e3b';
    if (nodeType === 'scenario') return isLight ? '#1e3a8a' : '#1e3a8a';
    if (nodeType === 'topic') return isLight ? '#083344' : '#083344';
    return isLight ? '#5b21b6' : '#5b21b6';
  };

  const edgeColor = (edgeType: EdgeType) => {
    if (edgeType === 'supports') return isLight ? '#10b981' : '#34d399';
    if (edgeType === 'invalidates') return isLight ? '#f43f5e' : '#fb7185';
    if (edgeType === 'confirmed-by') return isLight ? '#10b981' : '#34d399';
    if (edgeType === 'invalidated-by') return isLight ? '#f43f5e' : '#fb7185';
    if (edgeType === 'mentions') return isLight ? '#06b6d4' : '#22d3ee';
    return isLight ? '#6b7280' : '#9ca3af';
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const legendColors: { type: NodeType; color: string; label: string }[] = [
    { type: 'headline', color: getNodeColor('headline'), label: 'Headline' },
    { type: 'scenario', color: getNodeColor('scenario'), label: 'Scenario' },
    { type: 'asset', color: getNodeColor('asset'), label: 'Asset' },
    { type: 'topic', color: getNodeColor('topic'), label: 'Topic/Context' },
  ];

  const edgeLegend: { type: EdgeType; color: string; label: string }[] = [
    { type: 'supports', color: edgeColor('supports'), label: 'Supports' },
    { type: 'invalidates', color: edgeColor('invalidates'), label: 'Invalidates' },
    { type: 'mentions', color: edgeColor('mentions'), label: 'Mentions' },
    { type: 'affects', color: edgeColor('affects'), label: 'Affects' },
  ];

  if (graphData.nodes.length === 0) {
    return (
      <div className={`text-center ${isLight ? 'text-slate-500' : 'text-slate-400'} py-8`}>
        <Info className="w-8 h-8 mx-auto mb-2" />
        <p>No graph data available. Generate scenarios to visualize the knowledge graph.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100%-2rem)]">
      {/* Graph Canvas */}
      <div className="flex-1 overflow-hidden relative h-full">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {graphData.edges.map(edge => {
              const sourcePos = nodePositions[edge.source];
              const targetPos = nodePositions[edge.target];
              if (!sourcePos || !targetPos) return null;

              return (
                <line
                  key={edge.id}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={edgeColor(edge.type)}
                  strokeWidth={2}
                  opacity={0.6}
                />
              );
            })}

            {/* Nodes */}
            {graphData.nodes.map(node => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow effect */}
                  <circle
                    r={16}
                    fill={getNodeColor(node.type, node.metadata)}
                    opacity={0.2}
                    className="transition-opacity duration-200"
                  />
                  {/* Node circle */}
                  <circle
                    r={14}
                    fill={getNodeColor(node.type, node.metadata)}
                    className="transition-all duration-200 hover:r-16"
                  />
                  {/* Node label */}
                  <text
                    textAnchor="middle"
                    dy={22}
                    fill={getNodeLabelColor(node.type)}
                    fontSize="10"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom Controls */}
        <div className={`absolute bottom-4 left-4 p-2 rounded-lg ${isLight ? 'bg-white shadow-lg' : 'bg-slate-800 shadow-lg'} flex gap-1`}>
          <button
            onClick={handleZoomIn}
            className={`p-2 rounded ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-700'}`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className={`flex items-center px-2 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomOut}
            className={`p-2 rounded ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-700'}`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className={`p-2 rounded ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-700'}`}
            title="Reset View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className={`absolute top-4 right-4 p-3 rounded-lg ${isLight ? 'bg-white shadow-lg' : 'bg-slate-800 shadow-lg'} max-w-xs`}>
          <h4 className={`font-semibold text-sm mb-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Node Types</h4>
          <div className="space-y-1 text-xs">
            {legendColors.map(({ type, color, label }) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>{label}</span>
              </div>
            ))}
          </div>
          <h4 className={`font-semibold text-sm mt-3 mb-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Connections</h4>
          <div className="space-y-1 text-xs">
            {edgeLegend.map(({ type, color, label }) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-8 h-0.5" style={{ backgroundColor: color }} />
                <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Node Info */}
        {selectedNode && (
          <div className={`absolute top-4 left-4 p-4 rounded-lg ${isLight ? 'bg-white shadow-lg' : 'bg-slate-800 shadow-lg'} max-w-sm`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getNodeColor(selectedNode.type) }} />
                  <h4 className={`font-semibold text-sm ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{selectedNode.label}</h4>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{selectedNode.description || selectedNode.label}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className={`text-xs ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
