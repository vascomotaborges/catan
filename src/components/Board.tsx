import React, { useMemo } from 'react';
import type {
  GameState,
  HexTile,
  Terrain,
  PortType,
  Building,
  Road,
  Port,
} from '../types';

// ---- Props ----

interface BoardProps {
  gameState: GameState;
  validVertices?: string[];
  validEdges?: string[];
  validHexes?: string[];
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onHexClick?: (hexId: string) => void;
}

// ---- Constants ----

const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);
const PIXEL_SCALE = 60;

const TERRAIN_COLORS: Record<Terrain, string> = {
  wood: 'forestgreen',
  brick: 'firebrick',
  sheep: 'limegreen',
  wheat: 'gold',
  ore: 'slategray',
  desert: 'sandybrown',
};

const PLAYER_COLOR_MAP: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};

const PORT_EMOJI: Record<PortType, string> = {
  any: '3:1',
  wood: '2:1 🌲',
  brick: '2:1 🧱',
  sheep: '2:1 🐑',
  wheat: '2:1 🌾',
  ore: '2:1 ⛏️',
};

// ---- Geometry helpers ----

function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (3 / 2) * q * PIXEL_SCALE,
    y: HEX_SIZE * ((SQRT3 / 2) * q + SQRT3 * r) * PIXEL_SCALE,
  };
}

function hexCornerPoints(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    const px = cx + HEX_SIZE * PIXEL_SCALE * Math.cos(angleRad);
    const py = cy + HEX_SIZE * PIXEL_SCALE * Math.sin(angleRad);
    pts.push(`${px},${py}`);
  }
  return pts.join(' ');
}

/** Parse "v_x_y" into pixel coordinates (scaled). */
function vertexToPixel(vertexId: string): { x: number; y: number } {
  const rest = vertexId.slice(2);
  const match = rest.match(/^(-?[\d.]+)_(-?[\d.]+)$/);
  if (!match) {
    return { x: 0, y: 0 };
  }
  return {
    x: parseFloat(match[1]) * PIXEL_SCALE,
    y: parseFloat(match[2]) * PIXEL_SCALE,
  };
}

/** Parse "v_x_y__v_x_y" edge into two pixel endpoints. */
function edgeToPixels(edgeId: string): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const parts = edgeId.split('__');
  const p1 = vertexToPixel(parts[0]);
  const p2 = vertexToPixel(parts[1]);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Dots probability indicator: number of dots for a dice value. */
function dotsForNumber(n: number): number {
  if (n <= 7) return n - 1;
  return 13 - n;
}

// ---- SVG keyframe animation (injected once) ----

const PULSE_KEYFRAMES = `
@keyframes board-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
`;

// ---- Sub-components ----

function HexTileComponent({
  hex,
  isValid,
  onClick,
}: {
  hex: HexTile;
  isValid: boolean;
  onClick?: () => void;
}) {
  const center = hexToPixel(hex.coord.q, hex.coord.r);
  const points = hexCornerPoints(center.x, center.y);
  const color = TERRAIN_COLORS[hex.terrain];

  return (
    <g>
      {/* Hex polygon */}
      <polygon
        points={points}
        fill={color}
        stroke="#5d4037"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Number token */}
      {hex.number != null && (
        <g>
          <circle
            cx={center.x}
            cy={center.y}
            r={PIXEL_SCALE * 0.3}
            fill="#fdf5e6"
            stroke="#8d6e63"
            strokeWidth={1.5}
          />
          <text
            x={center.x}
            y={center.y - 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={PIXEL_SCALE * 0.28}
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
            fill={hex.number === 6 || hex.number === 8 ? '#c0392b' : '#333'}
          >
            {hex.number}
          </text>
          {/* Probability dots */}
          <text
            x={center.x}
            y={center.y + PIXEL_SCALE * 0.17}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={PIXEL_SCALE * 0.12}
            fill={hex.number === 6 || hex.number === 8 ? '#c0392b' : '#666'}
            fontFamily="Arial, sans-serif"
          >
            {'•'.repeat(dotsForNumber(hex.number))}
          </text>
        </g>
      )}
      {/* Valid hex overlay (for robber placement) */}
      {isValid && (
        <polygon
          points={points}
          fill="rgba(255, 0, 0, 0.15)"
          stroke="#e74c3c"
          strokeWidth={3}
          strokeDasharray="8,4"
          style={{
            cursor: 'pointer',
            animation: 'board-pulse 1.2s ease-in-out infinite',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        />
      )}
    </g>
  );
}

function RobberComponent({ hexId, hexes }: { hexId: string; hexes: Record<string, HexTile> }) {
  const hex = hexes[hexId];
  if (!hex) return null;
  const center = hexToPixel(hex.coord.q, hex.coord.r);
  return (
    <g>
      <circle
        cx={center.x}
        cy={center.y}
        r={PIXEL_SCALE * 0.35}
        fill="rgba(30, 30, 30, 0.6)"
        stroke="#111"
        strokeWidth={2}
      />
      <text
        x={center.x}
        y={center.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={PIXEL_SCALE * 0.28}
        fontFamily="Arial, sans-serif"
        fill="#fff"
      >
        {'👤'}
      </text>
    </g>
  );
}

function BuildingComponent({
  building,
  playerColor,
}: {
  building: Building;
  playerColor: string;
}) {
  const pos = vertexToPixel(building.vertexId);
  const isCity = building.type === 'city';
  const size = isCity ? PIXEL_SCALE * 0.2 : PIXEL_SCALE * 0.14;

  return (
    <g>
      <rect
        x={pos.x - size}
        y={pos.y - size}
        width={size * 2}
        height={size * 2}
        fill={playerColor}
        stroke="#333"
        strokeWidth={isCity ? 2.5 : 1.5}
        rx={isCity ? 2 : 1}
      />
      {isCity && (
        <rect
          x={pos.x - size * 0.5}
          y={pos.y - size * 1.5}
          width={size}
          height={size * 0.6}
          fill={playerColor}
          stroke="#333"
          strokeWidth={1.5}
          rx={1}
        />
      )}
    </g>
  );
}

function RoadComponent({
  road,
  playerColor,
  edges,
}: {
  road: Road;
  playerColor: string;
  edges: Record<string, { vertices: [string, string] }>;
}) {
  const edge = edges[road.edgeId];
  if (!edge) return null;
  const { x1, y1, x2, y2 } = edgeToPixels(road.edgeId);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={playerColor}
      strokeWidth={PIXEL_SCALE * 0.1}
      strokeLinecap="round"
    />
  );
}

function PortComponent({ port }: { port: Port }) {
  const p1 = vertexToPixel(port.vertices[0]);
  const p2 = vertexToPixel(port.vertices[1]);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // Push the label outward from center
  const dist = Math.sqrt(mx * mx + my * my);
  const pushFactor = dist > 0 ? PIXEL_SCALE * 0.55 / dist : 0;
  const lx = mx + mx * pushFactor;
  const ly = my + my * pushFactor;

  const label = PORT_EMOJI[port.type];

  return (
    <g>
      {/* Dock lines from each port vertex */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={lx}
        y2={ly}
        stroke="#8d6e63"
        strokeWidth={2}
        strokeDasharray="4,3"
      />
      <line
        x1={p2.x}
        y1={p2.y}
        x2={lx}
        y2={ly}
        stroke="#8d6e63"
        strokeWidth={2}
        strokeDasharray="4,3"
      />
      {/* Port label background */}
      <rect
        x={lx - PIXEL_SCALE * 0.38}
        y={ly - PIXEL_SCALE * 0.16}
        width={PIXEL_SCALE * 0.76}
        height={PIXEL_SCALE * 0.32}
        rx={4}
        fill="#fff8e1"
        stroke="#8d6e63"
        strokeWidth={1}
      />
      {/* Port label text */}
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={PIXEL_SCALE * 0.17}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill="#5d4037"
      >
        {label}
      </text>
    </g>
  );
}

function ValidVertexMarker({
  vertexId,
  onClick,
}: {
  vertexId: string;
  onClick: () => void;
}) {
  const pos = vertexToPixel(vertexId);
  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={PIXEL_SCALE * 0.14}
      fill="rgba(46, 204, 113, 0.7)"
      stroke="#27ae60"
      strokeWidth={2}
      style={{
        cursor: 'pointer',
        animation: 'board-pulse 1s ease-in-out infinite',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

function ValidEdgeMarker({
  edgeId,
  onClick,
}: {
  edgeId: string;
  onClick: () => void;
}) {
  const { x1, y1, x2, y2 } = edgeToPixels(edgeId);
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgba(46, 204, 113, 0.8)"
      strokeWidth={PIXEL_SCALE * 0.12}
      strokeLinecap="round"
      strokeDasharray="6,4"
      style={{
        cursor: 'pointer',
        animation: 'board-pulse 1s ease-in-out infinite',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

// ---- Main Board component ----

const Board: React.FC<BoardProps> = ({
  gameState,
  validVertices,
  validEdges,
  validHexes,
  onVertexClick,
  onEdgeClick,
  onHexClick,
}) => {
  const { board, buildings, roads, players } = gameState;

  // Build lookup from player id to hex color
  const playerColorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) {
      map[p.id] = PLAYER_COLOR_MAP[p.color] || '#999';
    }
    return map;
  }, [players]);

  // Compute viewBox from all hex centers
  const viewBox = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const hex of Object.values(board.hexes)) {
      const c = hexToPixel(hex.coord.q, hex.coord.r);
      const margin = PIXEL_SCALE * 1.6;
      minX = Math.min(minX, c.x - margin);
      minY = Math.min(minY, c.y - margin);
      maxX = Math.max(maxX, c.x + margin);
      maxY = Math.max(maxY, c.y + margin);
    }

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [board.hexes]);

  const validHexSet = useMemo(() => new Set(validHexes ?? []), [validHexes]);

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: '100%',
        maxWidth: 700,
        height: 'auto',
        display: 'block',
        margin: '0 auto',
        touchAction: 'manipulation',
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Inject animation keyframes */}
      <defs>
        <style>{PULSE_KEYFRAMES}</style>
      </defs>

      {/* Ocean background */}
      <rect
        x={viewBox.split(' ').map(Number)[0]}
        y={viewBox.split(' ').map(Number)[1]}
        width={viewBox.split(' ').map(Number)[2]}
        height={viewBox.split(' ').map(Number)[3]}
        fill="#2980b9"
        rx={12}
      />

      {/* Layer 1: Ports (behind hexes for dock lines) */}
      <g>
        {board.ports.map((port) => (
          <PortComponent key={port.edgeId} port={port} />
        ))}
      </g>

      {/* Layer 2: Hex tiles */}
      <g>
        {board.hexOrder.map((hId) => {
          const hex = board.hexes[hId];
          return (
            <HexTileComponent
              key={hId}
              hex={hex}
              isValid={validHexSet.has(hId)}
              onClick={() => onHexClick?.(hId)}
            />
          );
        })}
      </g>

      {/* Layer 3: Roads */}
      <g>
        {roads.map((road) => (
          <RoadComponent
            key={road.edgeId}
            road={road}
            playerColor={playerColorLookup[road.playerId] || '#999'}
            edges={board.edges}
          />
        ))}
      </g>

      {/* Layer 4: Valid edge markers */}
      <g>
        {(validEdges ?? []).map((eId) => (
          <ValidEdgeMarker
            key={eId}
            edgeId={eId}
            onClick={() => onEdgeClick?.(eId)}
          />
        ))}
      </g>

      {/* Layer 5: Buildings */}
      <g>
        {buildings.map((building) => (
          <BuildingComponent
            key={building.vertexId}
            building={building}
            playerColor={playerColorLookup[building.playerId] || '#999'}
          />
        ))}
      </g>

      {/* Layer 6: Valid vertex markers */}
      <g>
        {(validVertices ?? []).map((vId) => (
          <ValidVertexMarker
            key={vId}
            vertexId={vId}
            onClick={() => onVertexClick?.(vId)}
          />
        ))}
      </g>

      {/* Layer 7: Robber (on top of everything except interactive) */}
      <RobberComponent hexId={board.robberHexId} hexes={board.hexes} />
    </svg>
  );
};

export default Board;
