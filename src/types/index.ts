// ---- Resource & Terrain ----

export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export type Terrain = Resource | 'desert';

export const ALL_RESOURCES: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export const TERRAIN_DISTRIBUTION: Terrain[] = [
  'wood', 'wood', 'wood', 'wood',
  'brick', 'brick', 'brick',
  'sheep', 'sheep', 'sheep', 'sheep',
  'wheat', 'wheat', 'wheat', 'wheat',
  'ore', 'ore', 'ore',
  'desert',
];

export const NUMBER_TOKEN_DISTRIBUTION: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
];

// ---- Board Geometry ----

export interface HexCoord {
  q: number; // axial column
  r: number; // axial row
}

export interface HexTile {
  id: string;
  coord: HexCoord;
  terrain: Terrain;
  number: number | null; // null for desert
  hasRobber: boolean;
}

export interface Vertex {
  id: string;
  adjacentHexes: string[];   // hex ids
  adjacentEdges: string[];   // edge ids
  adjacentVertices: string[]; // vertex ids
}

export interface Edge {
  id: string;
  vertices: [string, string]; // vertex ids at endpoints
  adjacentHexes: string[];    // hex ids
}

export type PortType = Resource | 'any';

export interface Port {
  edgeId: string;
  type: PortType;
  vertices: [string, string];
}

export interface Board {
  hexes: Record<string, HexTile>;
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
  ports: Port[];
  hexOrder: string[]; // hex ids in layout order
  robberHexId: string;
}

// ---- Buildings ----

export type BuildingType = 'settlement' | 'city';

export interface Building {
  type: BuildingType;
  vertexId: string;
  playerId: string;
}

export interface Road {
  edgeId: string;
  playerId: string;
}

// ---- Development Cards ----

export type DevCardType =
  | 'knight'
  | 'road_building'
  | 'year_of_plenty'
  | 'monopoly'
  | 'victory_point';

export const DEV_CARD_DISTRIBUTION: DevCardType[] = [
  ...Array(14).fill('knight') as DevCardType[],
  ...Array(2).fill('road_building') as DevCardType[],
  ...Array(2).fill('year_of_plenty') as DevCardType[],
  ...Array(2).fill('monopoly') as DevCardType[],
  ...Array(5).fill('victory_point') as DevCardType[],
];

// ---- Player ----

export type PlayerColor = 'red' | 'blue' | 'white' | 'orange';
export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange'];

export interface PlayerResources {
  wood: number;
  brick: number;
  sheep: number;
  wheat: number;
  ore: number;
}

export function emptyResources(): PlayerResources {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function totalResources(r: PlayerResources): number {
  return r.wood + r.brick + r.sheep + r.wheat + r.ore;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  resources: PlayerResources;
  devCards: DevCardType[];
  devCardsPlayedThisTurn: number;
  knightsPlayed: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  victoryPoints: number;
  connected: boolean;
}

// ---- Trading ----

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  offering: Partial<PlayerResources>;
  requesting: Partial<PlayerResources>;
  acceptedBy: string[]; // player ids who accepted
  status: 'open' | 'accepted' | 'declined' | 'cancelled';
}

// ---- Chat ----

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'system' | 'trade';
}

// ---- Game Phases ----

export type GamePhase =
  | 'lobby'
  | 'setup_forward'     // placing first settlement+road (in order)
  | 'setup_reverse'     // placing second settlement+road (reverse order)
  | 'main'              // normal gameplay
  | 'robber_discard'    // players with >7 cards must discard
  | 'robber_move'       // active player moves robber
  | 'robber_steal'      // active player steals from adjacent player
  | 'road_building'     // playing road building dev card
  | 'year_of_plenty'    // playing year of plenty dev card
  | 'monopoly'          // playing monopoly dev card
  | 'game_over';

export type SetupSubAction = 'settlement' | 'road';

// ---- Game State ----

export interface GameSettings {
  turnTimerSeconds: number;
  maxPlayers: 4;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  board: Board;
  players: Player[];
  buildings: Building[];
  roads: Road[];
  currentPlayerIndex: number;
  diceRoll: [number, number] | null;
  devCardDeck: DevCardType[];
  tradeOffers: TradeOffer[];
  chatMessages: ChatMessage[];
  longestRoadPlayerId: string | null;
  largestArmyPlayerId: string | null;
  winnerId: string | null;
  turnTimer: number | null; // seconds remaining
  settings: GameSettings;
  setupSubAction: SetupSubAction | null;
  setupRound: number; // 0 for first round, 1 for second
  pendingDiscards: Record<string, number>; // playerId -> cards they still need to discard
  roadBuildingRoadsLeft: number;
  yearOfPlentyPicksLeft: number;
}

// ---- Network Actions ----

export type GameAction =
  | { type: 'join'; playerId: string; playerName: string }
  | { type: 'start_game' }
  | { type: 'roll_dice' }
  | { type: 'build_settlement'; vertexId: string }
  | { type: 'build_city'; vertexId: string }
  | { type: 'build_road'; edgeId: string }
  | { type: 'buy_dev_card' }
  | { type: 'play_dev_card'; card: DevCardType; params?: DevCardParams }
  | { type: 'propose_trade'; offer: Omit<TradeOffer, 'id' | 'status' | 'acceptedBy'> }
  | { type: 'accept_trade'; tradeId: string }
  | { type: 'decline_trade'; tradeId: string }
  | { type: 'confirm_trade'; tradeId: string; withPlayerId: string }
  | { type: 'cancel_trade'; tradeId: string }
  | { type: 'bank_trade'; offering: Partial<PlayerResources>; requesting: Partial<PlayerResources> }
  | { type: 'move_robber'; hexId: string }
  | { type: 'steal_resource'; fromPlayerId: string }
  | { type: 'discard_resources'; resources: Partial<PlayerResources> }
  | { type: 'end_turn' }
  | { type: 'send_chat'; message: string }
  | { type: 'year_of_plenty_pick'; resource: Resource }
  | { type: 'monopoly_pick'; resource: Resource }
  | { type: 'pause_game' }
  | { type: 'resume_game' };

export interface DevCardParams {
  resource?: Resource;
  resources?: [Resource, Resource];
}

// ---- Network Messages ----

export type NetworkMessage =
  | { type: 'action'; action: GameAction; playerId: string }
  | { type: 'state_sync'; state: GameState }
  | { type: 'player_joined'; player: Player }
  | { type: 'player_disconnected'; playerId: string }
  | { type: 'error'; message: string };

// ---- Building Costs ----

export const BUILDING_COSTS: Record<string, Partial<PlayerResources>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  dev_card: { sheep: 1, wheat: 1, ore: 1 },
};

// ---- Limits ----

export const MAX_SETTLEMENTS = 5;
export const MAX_CITIES = 4;
export const MAX_ROADS = 15;
export const VICTORY_POINTS_TO_WIN = 10;
