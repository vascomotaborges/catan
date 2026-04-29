import type {
  Board,
  HexCoord,
  HexTile,
  Vertex,
  Edge,
  Port,
  PortType,
} from '../types';
import {
  TERRAIN_DISTRIBUTION,
  NUMBER_TOKEN_DISTRIBUTION,
  ALL_RESOURCES,
} from '../types';

// ---- Constants ----

const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

// ---- Utility functions ----

/** Fisher-Yates shuffle (in-place, returns the array). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Round a number to 2 decimal places to use in vertex IDs. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Hex ID from axial coordinates. */
function hexId(q: number, r: number): string {
  return `hex_${q}_${r}`;
}

/** Pixel center of a flat-top hex at axial (q, r). */
function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (3 / 2) * q,
    y: HEX_SIZE * ((SQRT3 / 2) * q + SQRT3 * r),
  };
}

/** Compute the 6 corner positions for a flat-top hex centered at (cx, cy). */
function hexCorners(cx: number, cy: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: round2(cx + HEX_SIZE * Math.cos(angleRad)),
      y: round2(cy + HEX_SIZE * Math.sin(angleRad)),
    });
  }
  return corners;
}

/** Create a vertex ID from rounded pixel coordinates. */
function makeVertexId(x: number, y: number): string {
  return `v_${x}_${y}`;
}

/** Create an edge ID from two vertex IDs (sorted for canonical form). */
function makeEdgeId(v1: string, v2: string): string {
  return v1 < v2 ? `${v1}__${v2}` : `${v2}__${v1}`;
}

/**
 * Parse x, y coordinates from a vertex ID of the form "v_x_y".
 * Handles negative values correctly.
 */
function parseVertexCoords(id: string): { x: number; y: number } {
  // Remove the "v_" prefix, then match "x_y" where x and y can be negative decimals
  const rest = id.slice(2);
  const match = rest.match(/^(-?[\d.]+)_(-?[\d.]+)$/);
  if (!match) {
    throw new Error(`Invalid vertex ID format: ${id}`);
  }
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

// ---- Hex coordinate generation ----

/** Generate all 19 axial hex coordinates for a standard Catan board (rings 0-2). */
function generateHexCoords(): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const s = -q - r;
      if (Math.abs(q) <= 2 && Math.abs(r) <= 2 && Math.abs(s) <= 2) {
        coords.push({ q, r });
      }
    }
  }
  return coords;
}

// ---- Adjacency helpers ----

/** Check whether two hexes are adjacent in axial coordinates. */
function areHexesAdjacent(a: HexCoord, b: HexCoord): boolean {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return (
    Math.abs(dq) + Math.abs(dr) + Math.abs(ds) === 2 &&
    Math.abs(dq) <= 1 &&
    Math.abs(dr) <= 1 &&
    Math.abs(ds) <= 1
  );
}

// ---- Number placement validation ----

/**
 * Check that no two hexes with 6 or 8 are adjacent.
 * Returns true if the placement is valid.
 */
function isValidNumberPlacement(
  hexes: { coord: HexCoord; number: number | null }[]
): boolean {
  const highValueHexes = hexes.filter(
    (h) => h.number === 6 || h.number === 8
  );
  for (let i = 0; i < highValueHexes.length; i++) {
    for (let j = i + 1; j < highValueHexes.length; j++) {
      if (areHexesAdjacent(highValueHexes[i].coord, highValueHexes[j].coord)) {
        return false;
      }
    }
  }
  return true;
}

// ---- Port placement ----

/**
 * Place 9 ports around the perimeter of the board.
 *
 * A perimeter edge is one adjacent to exactly 1 hex.
 * We select 9 edges evenly spaced around the board perimeter.
 */
function placePorts(edges: Record<string, Edge>): Port[] {
  // Find all perimeter edges (adjacent to exactly 1 hex)
  const perimeterEdges: Edge[] = [];
  for (const edge of Object.values(edges)) {
    if (edge.adjacentHexes.length === 1) {
      perimeterEdges.push(edge);
    }
  }

  // Sort perimeter edges by angle from board center for even spacing.
  // Compute the midpoint of each edge, then its angle from origin.
  function edgeAngle(edge: Edge): number {
    const p1 = parseVertexCoords(edge.vertices[0]);
    const p2 = parseVertexCoords(edge.vertices[1]);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    return Math.atan2(my, mx);
  }

  perimeterEdges.sort((a, b) => edgeAngle(a) - edgeAngle(b));

  // Select 9 edges evenly spaced from the sorted perimeter
  const totalPerimeter = perimeterEdges.length;
  const step = totalPerimeter / 9;
  const selectedEdges: Edge[] = [];
  for (let i = 0; i < 9; i++) {
    const idx = Math.floor(i * step) % totalPerimeter;
    selectedEdges.push(perimeterEdges[idx]);
  }

  // Port types: 4x 'any' (3:1) and 5x resource-specific (2:1)
  const portTypes: PortType[] = shuffle([
    'any' as PortType,
    'any' as PortType,
    'any' as PortType,
    'any' as PortType,
    ...(ALL_RESOURCES as PortType[]),
  ]);

  return selectedEdges.map((edge, i) => ({
    edgeId: edge.id,
    type: portTypes[i],
    vertices: [edge.vertices[0], edge.vertices[1]] as [string, string],
  }));
}

// ---- Board generation ----

export function generateBoard(): Board {
  const hexCoords = generateHexCoords();

  // --- Shuffle terrains and assign to hexes ---
  const terrains = shuffle([...TERRAIN_DISTRIBUTION]);

  // --- Assign number tokens to non-desert hexes, ensuring 6/8 not adjacent ---
  let hexesWithNumbers: { coord: HexCoord; number: number | null }[];

  const MAX_ATTEMPTS = 1000;
  let attempts = 0;
  do {
    const numberTokens = shuffle([...NUMBER_TOKEN_DISTRIBUTION]);
    let tokenIdx = 0;
    hexesWithNumbers = hexCoords.map((coord, i) => {
      if (terrains[i] === 'desert') {
        return { coord, number: null };
      }
      return { coord, number: numberTokens[tokenIdx++] };
    });
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      // Fallback: accept whatever we have (extremely unlikely to reach here)
      break;
    }
  } while (!isValidNumberPlacement(hexesWithNumbers));

  // --- Build hex tiles ---
  const hexes: Record<string, HexTile> = {};
  const hexOrder: string[] = [];
  let robberHexId = '';

  for (let i = 0; i < hexCoords.length; i++) {
    const coord = hexCoords[i];
    const id = hexId(coord.q, coord.r);
    const terrain = terrains[i];
    const isDesert = terrain === 'desert';

    hexes[id] = {
      id,
      coord,
      terrain,
      number: hexesWithNumbers[i].number,
      hasRobber: isDesert,
    };

    if (isDesert) {
      robberHexId = id;
    }

    hexOrder.push(id);
  }

  // --- Compute vertices and edges ---
  // Maps to accumulate shared geometry
  const vertexMap = new Map<string, { adjacentHexIds: Set<string> }>();
  const edgeMap = new Map<
    string,
    { v1: string; v2: string; adjacentHexIds: Set<string> }
  >();

  for (const coord of hexCoords) {
    const hId = hexId(coord.q, coord.r);
    const center = hexToPixel(coord.q, coord.r);
    const corners = hexCorners(center.x, center.y);

    const vIds: string[] = corners.map((c) => makeVertexId(c.x, c.y));

    // Register vertices
    for (const vId of vIds) {
      if (!vertexMap.has(vId)) {
        vertexMap.set(vId, { adjacentHexIds: new Set() });
      }
      vertexMap.get(vId)!.adjacentHexIds.add(hId);
    }

    // Register edges (each edge connects consecutive corners)
    for (let i = 0; i < 6; i++) {
      const eId = makeEdgeId(vIds[i], vIds[(i + 1) % 6]);

      if (!edgeMap.has(eId)) {
        const sortedVerts: [string, string] =
          vIds[i] < vIds[(i + 1) % 6]
            ? [vIds[i], vIds[(i + 1) % 6]]
            : [vIds[(i + 1) % 6], vIds[i]];
        edgeMap.set(eId, {
          v1: sortedVerts[0],
          v2: sortedVerts[1],
          adjacentHexIds: new Set(),
        });
      }
      edgeMap.get(eId)!.adjacentHexIds.add(hId);
    }
  }

  // --- Build adjacency: vertex <-> edge, vertex <-> vertex ---
  const vertexToEdges = new Map<string, Set<string>>();
  const vertexToVertices = new Map<string, Set<string>>();

  for (const [eId, eData] of edgeMap) {
    for (const v of [eData.v1, eData.v2]) {
      if (!vertexToEdges.has(v)) {
        vertexToEdges.set(v, new Set());
      }
      vertexToEdges.get(v)!.add(eId);
    }

    if (!vertexToVertices.has(eData.v1)) {
      vertexToVertices.set(eData.v1, new Set());
    }
    vertexToVertices.get(eData.v1)!.add(eData.v2);

    if (!vertexToVertices.has(eData.v2)) {
      vertexToVertices.set(eData.v2, new Set());
    }
    vertexToVertices.get(eData.v2)!.add(eData.v1);
  }

  // --- Assemble Vertex objects ---
  const vertices: Record<string, Vertex> = {};
  for (const [vId, vData] of vertexMap) {
    vertices[vId] = {
      id: vId,
      adjacentHexes: Array.from(vData.adjacentHexIds),
      adjacentEdges: Array.from(vertexToEdges.get(vId) ?? []),
      adjacentVertices: Array.from(vertexToVertices.get(vId) ?? []),
    };
  }

  // --- Assemble Edge objects ---
  const edges: Record<string, Edge> = {};
  for (const [eId, eData] of edgeMap) {
    edges[eId] = {
      id: eId,
      vertices: [eData.v1, eData.v2],
      adjacentHexes: Array.from(eData.adjacentHexIds),
    };
  }

  // --- Ports ---
  const ports = placePorts(edges);

  return {
    hexes,
    vertices,
    edges,
    ports,
    hexOrder,
    robberHexId,
  };
}
