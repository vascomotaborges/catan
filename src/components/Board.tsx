import React, { useMemo } from "react";
import type {
  GameState,
  HexTile,
  Terrain,
  PortType,
  Building,
  Road,
  Port,
} from "../types";

import imgWood from "../assets/board/wood.jpg";
import imgBrick from "../assets/board/brick.jpg";
import imgSheep from "../assets/board/sheep.jpg";
import imgWheat from "../assets/board/wheat.jpg";
import imgOre from "../assets/board/ore.jpg";
import imgDesert from "../assets/board/desert.jpg";
import imgSea from "../assets/board/sea.jpg";

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

const TERRAIN_IMAGES: Record<Terrain, string> = {
  wood: imgWood,
  brick: imgBrick,
  sheep: imgSheep,
  wheat: imgWheat,
  ore: imgOre,
  desert: imgDesert,
};

const PLAYER_COLOR_MAP: Record<string, string> = {
  red: "#e74c3c",
  blue: "#3498db",
  white: "#ecf0f1",
  orange: "#e67e22",
};

const PORT_EMOJI: Record<PortType, string> = {
  any: "3:1",
  wood: "2:1 🪵",
  brick: "2:1 🧱",
  sheep: "2:1 🐑",
  wheat: "2:1 🌾",
  ore: "2:1 🪨",
};

const HEX_RADIUS = HEX_SIZE * PIXEL_SCALE;
const HEX_WIDTH = HEX_RADIUS * 2;
const HEX_HEIGHT = SQRT3 * HEX_RADIUS;

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
  return pts.join(" ");
}

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

function edgeToPixels(edgeId: string): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const parts = edgeId.split("__");
  const p1 = vertexToPixel(parts[0]);
  const p2 = vertexToPixel(parts[1]);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function dotsForNumber(n: number): number {
  if (n <= 7) return n - 1;
  return 13 - n;
}

// ---- SVG keyframe animation ----

const PULSE_KEYFRAMES = `
@keyframes board-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
`;

const SEA_PATTERN_SIZE = PIXEL_SCALE * 2;

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
  const clipId = `clip-${hex.id}`;
  const img = TERRAIN_IMAGES[hex.terrain];

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <polygon points={points} />
        </clipPath>
      </defs>
      <image
        href={img}
        x={center.x - HEX_WIDTH / 2}
        y={center.y - HEX_HEIGHT / 2}
        width={HEX_WIDTH}
        height={HEX_HEIGHT}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
      <polygon
        points={points}
        fill="none"
        stroke="#333"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <polygon
        points={points}
        fill="none"
        stroke="#fdf5e6"
        strokeWidth={2}
        strokeLinejoin="round"
      />
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
            fill={hex.number === 6 || hex.number === 8 ? "#c0392b" : "#333"}
          >
            {hex.number}
          </text>
          <text
            x={center.x}
            y={center.y + PIXEL_SCALE * 0.17}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={PIXEL_SCALE * 0.12}
            fill={hex.number === 6 || hex.number === 8 ? "#c0392b" : "#666"}
            fontFamily="Arial, sans-serif"
          >
            {"•".repeat(dotsForNumber(hex.number))}
          </text>
        </g>
      )}
      {isValid && (
        <polygon
          points={points}
          fill="rgba(255, 0, 0, 0.15)"
          stroke="#e74c3c"
          strokeWidth={3}
          strokeDasharray="8,4"
          style={{
            cursor: "pointer",
            animation: "board-pulse 1.2s ease-in-out infinite",
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick?.();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick?.();
          }}
        />
      )}
    </g>
  );
}

function RobberComponent({
  hexId,
  hexes,
}: {
  hexId: string;
  hexes: Record<string, HexTile>;
}) {
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
        fill="#fdf5e6"
      >
        {"🥷"}
      </text>
    </g>
  );
}

function SettlementShape({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  const s = PIXEL_SCALE * 0.16;
  // House body
  const bodyL = x - s;
  const bodyR = x + s;
  const bodyTop = y - s * 0.2;
  const bodyBot = y + s;
  // Roof peak
  const roofPeak = y - s * 1.2;
  // Chimney
  const chimL = x + s * 0.3;
  const chimR = x + s * 0.7;
  const chimTop = y - s * 1.0;
  const chimBot = y - s * 0.5;
  // Door
  const doorL = x - s * 0.25;
  const doorR = x + s * 0.25;
  const doorTop = y + s * 0.3;
  const doorBot = bodyBot;

  return (
    <g>
      {/* Chimney (behind roof) */}
      <rect
        x={chimL}
        y={chimTop}
        width={chimR - chimL}
        height={chimBot - chimTop}
        fill={color}
        stroke="#333"
        strokeWidth={1}
      />
      {/* Roof */}
      <polygon
        points={`${bodyL - s * 0.2},${bodyTop} ${x},${roofPeak} ${bodyR + s * 0.2},${bodyTop}`}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Body */}
      <rect
        x={bodyL}
        y={bodyTop}
        width={bodyR - bodyL}
        height={bodyBot - bodyTop}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
      {/* Door */}
      <rect
        x={doorL}
        y={doorTop}
        width={doorR - doorL}
        height={doorBot - doorTop}
        fill="#333"
        rx={1}
      />
    </g>
  );
}

function CityShape({ x, y, color }: { x: number; y: number; color: string }) {
  const s = PIXEL_SCALE * 0.16;
  // Main building (right, taller)
  const mainL = x - s * 0.1;
  const mainR = x + s * 1.1;
  const mainTop = y - s * 1.4;
  const mainBot = y + s;
  // Side building (left, shorter)
  const sideL = x - s * 1.1;
  const sideR = mainL;
  const sideTop = y - s * 0.5;
  const sideBot = mainBot;
  // Tower on main building
  const towerL = x + s * 0.2;
  const towerR = x + s * 0.8;
  const towerTop = y - s * 2.0;
  const towerBot = mainTop;
  // Tower cap (pointed)
  const capPeak = y - s * 2.5;
  // Windows on main
  const winSize = s * 0.3;
  const win1x = x + s * 0.15;
  const win2x = x + s * 0.65;
  const winRow1y = y - s * 0.9;
  const winRow2y = y - s * 0.2;

  return (
    <g>
      {/* Tower */}
      <rect
        x={towerL}
        y={towerTop}
        width={towerR - towerL}
        height={towerBot - towerTop}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
      {/* Tower cap */}
      <polygon
        points={`${towerL - s * 0.1},${towerTop} ${(towerL + towerR) / 2},${capPeak} ${towerR + s * 0.1},${towerTop}`}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Main building */}
      <rect
        x={mainL}
        y={mainTop}
        width={mainR - mainL}
        height={mainBot - mainTop}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
      {/* Side building */}
      <rect
        x={sideL}
        y={sideTop}
        width={sideR - sideL}
        height={sideBot - sideTop}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
      {/* Windows on main */}
      <rect
        x={win1x}
        y={winRow1y}
        width={winSize}
        height={winSize}
        fill="#333"
        rx={0.5}
      />
      <rect
        x={win2x}
        y={winRow1y}
        width={winSize}
        height={winSize}
        fill="#333"
        rx={0.5}
      />
      <rect
        x={win1x}
        y={winRow2y}
        width={winSize}
        height={winSize}
        fill="#333"
        rx={0.5}
      />
      <rect
        x={win2x}
        y={winRow2y}
        width={winSize}
        height={winSize}
        fill="#333"
        rx={0.5}
      />
      {/* Door */}
      <rect
        x={sideL + (sideR - sideL) * 0.25}
        y={y + s * 0.3}
        width={(sideR - sideL) * 0.5}
        height={mainBot - (y + s * 0.3)}
        fill="#333"
        rx={1}
      />
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

  if (building.type === "city") {
    return <CityShape x={pos.x} y={pos.y} color={playerColor} />;
  }
  return <SettlementShape x={pos.x} y={pos.y} color={playerColor} />;
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
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#333"
        strokeWidth={PIXEL_SCALE * 0.14}
        strokeLinecap="round"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={playerColor}
        strokeWidth={PIXEL_SCALE * 0.09}
        strokeLinecap="round"
      />
    </g>
  );
}

function PortComponent({ port }: { port: Port }) {
  const p1 = vertexToPixel(port.vertices[0]);
  const p2 = vertexToPixel(port.vertices[1]);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const dist = Math.sqrt(mx * mx + my * my);
  const pushFactor = dist > 0 ? (PIXEL_SCALE * 0.55) / dist : 0;
  const lx = mx + mx * pushFactor;
  const ly = my + my * pushFactor;

  const label = PORT_EMOJI[port.type];

  return (
    <g>
      <line
        x1={p1.x}
        y1={p1.y}
        x2={lx}
        y2={ly}
        stroke="#fdf5e6"
        strokeWidth={2}
        strokeDasharray="4,3"
      />
      <line
        x1={p2.x}
        y1={p2.y}
        x2={lx}
        y2={ly}
        stroke="#fdf5e6"
        strokeWidth={2}
        strokeDasharray="4,3"
      />
      <rect
        x={lx - PIXEL_SCALE * 0.38}
        y={ly - PIXEL_SCALE * 0.16}
        width={PIXEL_SCALE * 0.76}
        height={PIXEL_SCALE * 0.32}
        rx={4}
        fill="#fdf5e6"
        stroke="#8d6e63"
        strokeWidth={1}
      />
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
  const handleTap = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  };
  return (
    <g>
      <circle
        cx={pos.x}
        cy={pos.y}
        r={PIXEL_SCALE * 0.3}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onPointerDown={handleTap}
        onClick={handleTap}
      />
      <circle
        cx={pos.x}
        cy={pos.y}
        r={PIXEL_SCALE * 0.14}
        fill="rgba(46, 204, 113, 0.7)"
        stroke="#27ae60"
        strokeWidth={2}
        pointerEvents="none"
        style={{
          animation: "board-pulse 1s ease-in-out infinite",
        }}
      />
    </g>
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
  const handleTap = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  };
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={PIXEL_SCALE * 0.3}
        strokeLinecap="round"
        style={{ cursor: "pointer" }}
        onPointerDown={handleTap}
        onClick={handleTap}
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(46, 204, 113, 0.8)"
        strokeWidth={PIXEL_SCALE * 0.12}
        strokeLinecap="round"
        strokeDasharray="6,4"
        pointerEvents="none"
        style={{
          animation: "board-pulse 1s ease-in-out infinite",
        }}
      />
    </g>
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

  const playerColorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) {
      map[p.id] = PLAYER_COLOR_MAP[p.color] || "#999";
    }
    return map;
  }, [players]);

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

  const [vbX, vbY, vbW, vbH] = viewBox.split(" ").map(Number);

  const validHexSet = useMemo(() => new Set(validHexes ?? []), [validHexes]);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        display: "block",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        userSelect: "none",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{PULSE_KEYFRAMES}</style>
        <pattern
          id="pattern-sea"
          patternUnits="userSpaceOnUse"
          width={SEA_PATTERN_SIZE}
          height={SEA_PATTERN_SIZE}
        >
          <image
            href={imgSea}
            x={0}
            y={0}
            width={SEA_PATTERN_SIZE}
            height={SEA_PATTERN_SIZE}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      </defs>

      {/* Ocean background with tiled sea texture */}
      <rect
        x={vbX}
        y={vbY}
        width={vbW}
        height={vbH}
        fill="url(#pattern-sea)"
        rx={12}
      />

      {/* Layer 1: Ports */}
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
            playerColor={playerColorLookup[road.playerId] || "#999"}
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
            playerColor={playerColorLookup[building.playerId] || "#999"}
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

      {/* Layer 7: Robber */}
      <RobberComponent hexId={board.robberHexId} hexes={board.hexes} />
    </svg>
  );
};

export default Board;
