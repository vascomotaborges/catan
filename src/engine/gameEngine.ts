import { v4 as uuid } from 'uuid';
import type {
  GameState,
  GameAction,
  Player,
  Resource,
  PlayerResources,
  DevCardType,
  TradeOffer,
  Building,
  Road,
  Board,
  GameSettings,
  PlayerColor,
} from '../types';
import {
  BUILDING_COSTS,
  ALL_RESOURCES,
  MAX_SETTLEMENTS,
  MAX_CITIES,
  MAX_ROADS,
  VICTORY_POINTS_TO_WIN,
  emptyResources,
  totalResources,
  DEV_CARD_DISTRIBUTION,
  PLAYER_COLORS,
} from '../types';
import { generateBoard } from './board';

// ---- Helpers ----

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollDie(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 6) + 1;
}

function canAfford(resources: PlayerResources, cost: Partial<PlayerResources>): boolean {
  for (const r of ALL_RESOURCES) {
    if ((cost[r] || 0) > resources[r]) return false;
  }
  return true;
}

function deductResources(resources: PlayerResources, cost: Partial<PlayerResources>): PlayerResources {
  const result = { ...resources };
  for (const r of ALL_RESOURCES) {
    result[r] -= cost[r] || 0;
  }
  return result;
}

function addResources(resources: PlayerResources, gain: Partial<PlayerResources>): PlayerResources {
  const result = { ...resources };
  for (const r of ALL_RESOURCES) {
    result[r] += gain[r] || 0;
  }
  return result;
}

// ---- Longest Road (DFS) ----

function computeLongestRoad(playerId: string, roads: Road[], board: Board): number {
  const playerRoads = roads.filter(r => r.playerId === playerId);
  if (playerRoads.length === 0) return 0;

  const adj: Record<string, string[]> = {};
  for (const road of playerRoads) {
    const edge = board.edges[road.edgeId];
    if (!edge) continue;
    const [v1, v2] = edge.vertices;
    if (!adj[v1]) adj[v1] = [];
    if (!adj[v2]) adj[v2] = [];
    adj[v1].push(road.edgeId);
    adj[v2].push(road.edgeId);
  }

  let maxLen = 0;

  function dfs(vertexId: string, visited: Set<string>, length: number) {
    maxLen = Math.max(maxLen, length);
    const edges = adj[vertexId] || [];
    for (const edgeId of edges) {
      if (visited.has(edgeId)) continue;
      const edge = board.edges[edgeId];
      const nextVertex = edge.vertices[0] === vertexId ? edge.vertices[1] : edge.vertices[0];
      visited.add(edgeId);
      dfs(nextVertex, visited, length + 1);
      visited.delete(edgeId);
    }
  }

  for (const vertexId of Object.keys(adj)) {
    dfs(vertexId, new Set(), 0);
  }

  return maxLen;
}

// ---- Victory Points ----

function calculateVP(player: Player, buildings: Building[], longestRoadHolder: string | null, largestArmyHolder: string | null): number {
  let vp = 0;
  for (const b of buildings) {
    if (b.playerId !== player.id) continue;
    vp += b.type === 'settlement' ? 1 : 2;
  }
  if (longestRoadHolder === player.id) vp += 2;
  if (largestArmyHolder === player.id) vp += 2;
  vp += player.devCards.filter(c => c === 'victory_point').length;
  return vp;
}

// ---- Initial State ----

export function createInitialState(settings: GameSettings): GameState {
  return {
    id: uuid(),
    phase: 'lobby',
    board: generateBoard(),
    players: [],
    buildings: [],
    roads: [],
    currentPlayerIndex: 0,
    diceRoll: null,
    devCardDeck: shuffle([...DEV_CARD_DISTRIBUTION]),
    tradeOffers: [],
    chatMessages: [],
    longestRoadPlayerId: null,
    largestArmyPlayerId: null,
    winnerId: null,
    turnTimer: null,
    settings,
    setupSubAction: null,
    setupRound: 0,
    pendingDiscards: {},
    roadBuildingRoadsLeft: 0,
    yearOfPlentyPicksLeft: 0,
  };
}

// ---- Main Reducer ----

export function applyAction(state: GameState, action: GameAction, actingPlayerId: string): GameState {
  let s = { ...state };

  switch (action.type) {
    case 'join':
      return handleJoin(s, action.playerId, action.playerName);
    case 'start_game':
      return handleStartGame(s);
    case 'roll_dice':
      return handleRollDice(s, actingPlayerId);
    case 'build_settlement':
      return handleBuildSettlement(s, actingPlayerId, action.vertexId);
    case 'build_city':
      return handleBuildCity(s, actingPlayerId, action.vertexId);
    case 'build_road':
      return handleBuildRoad(s, actingPlayerId, action.edgeId);
    case 'buy_dev_card':
      return handleBuyDevCard(s, actingPlayerId);
    case 'play_dev_card':
      return handlePlayDevCard(s, actingPlayerId, action.card, action.params);
    case 'propose_trade':
      return handleProposeTrade(s, actingPlayerId, action.offer);
    case 'accept_trade':
      return handleAcceptTrade(s, actingPlayerId, action.tradeId);
    case 'decline_trade':
      return handleDeclineTrade(s, actingPlayerId, action.tradeId);
    case 'confirm_trade':
      return handleConfirmTrade(s, actingPlayerId, action.tradeId, action.withPlayerId);
    case 'cancel_trade':
      return handleCancelTrade(s, actingPlayerId, action.tradeId);
    case 'bank_trade':
      return handleBankTrade(s, actingPlayerId, action.offering, action.requesting);
    case 'move_robber':
      return handleMoveRobber(s, actingPlayerId, action.hexId);
    case 'steal_resource':
      return handleStealResource(s, actingPlayerId, action.fromPlayerId);
    case 'discard_resources':
      return handleDiscardResources(s, actingPlayerId, action.resources);
    case 'end_turn':
      return handleEndTurn(s, actingPlayerId);
    case 'send_chat':
      return handleChat(s, actingPlayerId, action.message);
    case 'year_of_plenty_pick':
      return handleYearOfPlentyPick(s, actingPlayerId, action.resource);
    case 'monopoly_pick':
      return handleMonopolyPick(s, actingPlayerId, action.resource);
    default:
      return s;
  }
}

// ---- Action Handlers ----

function handleJoin(s: GameState, playerId: string, playerName: string): GameState {
  if (s.phase !== 'lobby') return s;
  if (s.players.length >= 4) return s;
  if (s.players.some(p => p.id === playerId)) return s;

  const color: PlayerColor = PLAYER_COLORS[s.players.length];
  const player: Player = {
    id: playerId,
    name: playerName,
    color,
    resources: emptyResources(),
    devCards: [],
    devCardsPlayedThisTurn: 0,
    knightsPlayed: 0,
    hasLongestRoad: false,
    hasLargestArmy: false,
    victoryPoints: 0,
    connected: true,
  };

  return {
    ...s,
    players: [...s.players, player],
    chatMessages: [
      ...s.chatMessages,
      {
        id: uuid(),
        playerId: 'system',
        playerName: 'System',
        text: `${playerName} joined the game`,
        timestamp: Date.now(),
        type: 'system',
      },
    ],
  };
}

function handleStartGame(s: GameState): GameState {
  if (s.phase !== 'lobby') return s;
  if (s.players.length < 2) return s;

  const playerOrder = shuffle(s.players.map((_, i) => i));
  const reassigned = playerOrder.map((origIdx, newIdx) => ({
    ...s.players[origIdx],
    color: PLAYER_COLORS[newIdx],
  }));

  return {
    ...s,
    players: reassigned,
    phase: 'setup_forward',
    currentPlayerIndex: 0,
    setupSubAction: 'settlement',
    setupRound: 0,
    board: generateBoard(),
    chatMessages: [
      ...s.chatMessages,
      {
        id: uuid(),
        playerId: 'system',
        playerName: 'System',
        text: `Game started! ${reassigned[0].name} goes first.`,
        timestamp: Date.now(),
        type: 'system',
      },
    ],
  };
}

function handleRollDice(s: GameState, actingPlayerId: string): GameState {
  if (s.phase !== 'main') return s;
  if (s.players[s.currentPlayerIndex].id !== actingPlayerId) return s;
  if (s.diceRoll !== null) return s;

  const d1 = rollDie();
  const d2 = rollDie();
  const total = d1 + d2;
  s = { ...s, diceRoll: [d1, d2] };

  if (total === 7) {
    const pendingDiscards: Record<string, number> = {};
    for (const p of s.players) {
      const count = totalResources(p.resources);
      if (count > 7) {
        pendingDiscards[p.id] = Math.floor(count / 2);
      }
    }
    if (Object.keys(pendingDiscards).length > 0) {
      return { ...s, phase: 'robber_discard', pendingDiscards };
    }
    return { ...s, phase: 'robber_move' };
  }

  s = distributeResources(s, total);
  return s;
}

function distributeResources(s: GameState, roll: number): GameState {
  const players = s.players.map(p => ({ ...p, resources: { ...p.resources } }));

  for (const hex of Object.values(s.board.hexes)) {
    if (hex.number !== roll || hex.hasRobber) continue;
    if (hex.terrain === 'desert') continue;

    const resource = hex.terrain as Resource;
    for (const building of s.buildings) {
      const vertex = s.board.vertices[building.vertexId];
      if (!vertex || !vertex.adjacentHexes.includes(hex.id)) continue;

      const pIdx = players.findIndex(p => p.id === building.playerId);
      if (pIdx === -1) continue;
      const amount = building.type === 'city' ? 2 : 1;
      players[pIdx].resources[resource] += amount;
    }
  }

  return { ...s, players };
}

function handleBuildSettlement(s: GameState, actingPlayerId: string, vertexId: string): GameState {
  const isSetup = s.phase === 'setup_forward' || s.phase === 'setup_reverse';
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);

  if (isSetup) {
    if (playerIdx !== s.currentPlayerIndex) return s;
    if (s.setupSubAction !== 'settlement') return s;
    if (!isValidSetupSettlement(s, vertexId)) return s;

    const building: Building = { type: 'settlement', vertexId, playerId: actingPlayerId };
    s = {
      ...s,
      buildings: [...s.buildings, building],
      setupSubAction: 'road',
    };

    if (s.phase === 'setup_reverse') {
      const hex_ids = s.board.vertices[vertexId].adjacentHexes;
      const players = s.players.map((p, i) => {
        if (i !== playerIdx) return p;
        const res = { ...p.resources };
        for (const hid of hex_ids) {
          const hex = s.board.hexes[hid];
          if (hex && hex.terrain !== 'desert') {
            res[hex.terrain as Resource] += 1;
          }
        }
        return { ...p, resources: res };
      });
      s = { ...s, players };
    }

    return s;
  }

  if (s.phase !== 'main') return s;
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (s.diceRoll === null) return s;

  const player = s.players[playerIdx];
  if (!canAfford(player.resources, BUILDING_COSTS.settlement)) return s;

  const playerSettlements = s.buildings.filter(b => b.playerId === actingPlayerId && b.type === 'settlement');
  if (playerSettlements.length >= MAX_SETTLEMENTS) return s;
  if (!isValidSettlementPlacement(s, actingPlayerId, vertexId)) return s;

  const building: Building = { type: 'settlement', vertexId, playerId: actingPlayerId };
  const players = s.players.map((p, i) =>
    i === playerIdx ? { ...p, resources: deductResources(p.resources, BUILDING_COSTS.settlement) } : p
  );

  s = { ...s, buildings: [...s.buildings, building], players };
  return updateSpecialCards(s);
}

function handleBuildCity(s: GameState, actingPlayerId: string, vertexId: string): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (s.diceRoll === null) return s;

  const player = s.players[playerIdx];
  if (!canAfford(player.resources, BUILDING_COSTS.city)) return s;

  const existingBuilding = s.buildings.find(b => b.vertexId === vertexId && b.playerId === actingPlayerId && b.type === 'settlement');
  if (!existingBuilding) return s;

  const playerCities = s.buildings.filter(b => b.playerId === actingPlayerId && b.type === 'city');
  if (playerCities.length >= MAX_CITIES) return s;

  const buildings = s.buildings.map(b =>
    b.vertexId === vertexId && b.playerId === actingPlayerId ? { ...b, type: 'city' as const } : b
  );
  const players = s.players.map((p, i) =>
    i === playerIdx ? { ...p, resources: deductResources(p.resources, BUILDING_COSTS.city) } : p
  );

  s = { ...s, buildings, players };
  return updateSpecialCards(s);
}

function handleBuildRoad(s: GameState, actingPlayerId: string, edgeId: string): GameState {
  const isSetup = s.phase === 'setup_forward' || s.phase === 'setup_reverse';
  const isRoadBuilding = s.phase === 'road_building';
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);

  if (isSetup) {
    if (playerIdx !== s.currentPlayerIndex) return s;
    if (s.setupSubAction !== 'road') return s;
    if (!isValidSetupRoad(s, actingPlayerId, edgeId)) return s;

    const road: Road = { edgeId, playerId: actingPlayerId };
    s = { ...s, roads: [...s.roads, road] };
    return advanceSetup(s);
  }

  if (isRoadBuilding) {
    if (playerIdx !== s.currentPlayerIndex) return s;
    if (s.roadBuildingRoadsLeft <= 0) return s;
    if (!isValidRoadPlacement(s, actingPlayerId, edgeId)) return s;

    const road: Road = { edgeId, playerId: actingPlayerId };
    const roadsLeft = s.roadBuildingRoadsLeft - 1;
    s = {
      ...s,
      roads: [...s.roads, road],
      roadBuildingRoadsLeft: roadsLeft,
      phase: roadsLeft === 0 ? 'main' : 'road_building',
    };
    return updateSpecialCards(s);
  }

  if (s.phase !== 'main') return s;
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (s.diceRoll === null) return s;

  const player = s.players[playerIdx];
  if (!canAfford(player.resources, BUILDING_COSTS.road)) return s;

  const playerRoads = s.roads.filter(r => r.playerId === actingPlayerId);
  if (playerRoads.length >= MAX_ROADS) return s;
  if (!isValidRoadPlacement(s, actingPlayerId, edgeId)) return s;

  const road: Road = { edgeId, playerId: actingPlayerId };
  const players = s.players.map((p, i) =>
    i === playerIdx ? { ...p, resources: deductResources(p.resources, BUILDING_COSTS.road) } : p
  );

  s = { ...s, roads: [...s.roads, road], players };
  return updateSpecialCards(s);
}

function handleBuyDevCard(s: GameState, actingPlayerId: string): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (s.diceRoll === null) return s;
  if (s.devCardDeck.length === 0) return s;

  const player = s.players[playerIdx];
  if (!canAfford(player.resources, BUILDING_COSTS.dev_card)) return s;

  const deck = [...s.devCardDeck];
  const card = deck.pop()!;

  const players = s.players.map((p, i) =>
    i === playerIdx
      ? {
          ...p,
          resources: deductResources(p.resources, BUILDING_COSTS.dev_card),
          devCards: [...p.devCards, card],
        }
      : p
  );

  s = { ...s, players, devCardDeck: deck };
  return updateSpecialCards(s);
}

function handlePlayDevCard(s: GameState, actingPlayerId: string, card: DevCardType, _params?: any): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (card === 'victory_point') return s;

  const player = s.players[playerIdx];
  if (player.devCardsPlayedThisTurn >= 1) return s;

  const cardIdx = player.devCards.indexOf(card);
  if (cardIdx === -1) return s;

  const newDevCards = [...player.devCards];
  newDevCards.splice(cardIdx, 1);

  let players = s.players.map((p, i) =>
    i === playerIdx
      ? { ...p, devCards: newDevCards, devCardsPlayedThisTurn: p.devCardsPlayedThisTurn + 1 }
      : p
  );

  switch (card) {
    case 'knight': {
      players = players.map((p, i) =>
        i === playerIdx ? { ...p, knightsPlayed: p.knightsPlayed + 1 } : p
      );
      s = { ...s, players, phase: 'robber_move' };
      return updateSpecialCards(s);
    }
    case 'road_building':
      return { ...s, players, phase: 'road_building', roadBuildingRoadsLeft: 2 };
    case 'year_of_plenty':
      return { ...s, players, phase: 'year_of_plenty', yearOfPlentyPicksLeft: 2 };
    case 'monopoly':
      return { ...s, players, phase: 'monopoly' };
    default:
      return { ...s, players };
  }
}

function handleYearOfPlentyPick(s: GameState, actingPlayerId: string, resource: Resource): GameState {
  if (s.phase !== 'year_of_plenty') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;

  const players = s.players.map((p, i) => {
    if (i !== playerIdx) return p;
    const res = { ...p.resources };
    res[resource] += 1;
    return { ...p, resources: res };
  });

  const picksLeft = s.yearOfPlentyPicksLeft - 1;
  return {
    ...s,
    players,
    yearOfPlentyPicksLeft: picksLeft,
    phase: picksLeft === 0 ? 'main' : 'year_of_plenty',
  };
}

function handleMonopolyPick(s: GameState, actingPlayerId: string, resource: Resource): GameState {
  if (s.phase !== 'monopoly') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;

  let totalStolen = 0;
  const players = s.players.map((p, i) => {
    if (i === playerIdx) return p;
    const amount = p.resources[resource];
    totalStolen += amount;
    return { ...p, resources: { ...p.resources, [resource]: 0 } };
  });

  players[playerIdx] = {
    ...players[playerIdx],
    resources: { ...players[playerIdx].resources, [resource]: players[playerIdx].resources[resource] + totalStolen },
  };

  return { ...s, players, phase: 'main' };
}

function handleProposeTrade(s: GameState, actingPlayerId: string, offer: Omit<TradeOffer, 'id' | 'status' | 'acceptedBy'>): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;

  const trade: TradeOffer = {
    id: uuid(),
    ...offer,
    fromPlayerId: actingPlayerId,
    acceptedBy: [],
    status: 'open',
  };

  return {
    ...s,
    tradeOffers: [...s.tradeOffers, trade],
    chatMessages: [
      ...s.chatMessages,
      {
        id: uuid(),
        playerId: actingPlayerId,
        playerName: s.players[playerIdx].name,
        text: `Proposed a trade`,
        timestamp: Date.now(),
        type: 'trade',
      },
    ],
  };
}

function handleAcceptTrade(s: GameState, actingPlayerId: string, tradeId: string): GameState {
  const trade = s.tradeOffers.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return s;
  if (trade.fromPlayerId === actingPlayerId) return s;

  return {
    ...s,
    tradeOffers: s.tradeOffers.map(t =>
      t.id === tradeId ? { ...t, acceptedBy: [...t.acceptedBy, actingPlayerId] } : t
    ),
  };
}

function handleDeclineTrade(s: GameState, _actingPlayerId: string, tradeId: string): GameState {
  const trade = s.tradeOffers.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return s;
  return s;
}

function handleConfirmTrade(s: GameState, actingPlayerId: string, tradeId: string, withPlayerId: string): GameState {
  const trade = s.tradeOffers.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return s;
  if (trade.fromPlayerId !== actingPlayerId) return s;
  if (!trade.acceptedBy.includes(withPlayerId)) return s;

  const fromIdx = s.players.findIndex(p => p.id === actingPlayerId);
  const toIdx = s.players.findIndex(p => p.id === withPlayerId);
  if (fromIdx === -1 || toIdx === -1) return s;

  const fromPlayer = s.players[fromIdx];
  const toPlayer = s.players[toIdx];

  if (!canAfford(fromPlayer.resources, trade.offering)) return s;
  if (!canAfford(toPlayer.resources, trade.requesting)) return s;

  const players = s.players.map((p, i) => {
    if (i === fromIdx) {
      let res = deductResources(p.resources, trade.offering);
      res = addResources(res, trade.requesting);
      return { ...p, resources: res };
    }
    if (i === toIdx) {
      let res = deductResources(p.resources, trade.requesting);
      res = addResources(res, trade.offering);
      return { ...p, resources: res };
    }
    return p;
  });

  return {
    ...s,
    players,
    tradeOffers: s.tradeOffers.map(t => (t.id === tradeId ? { ...t, status: 'accepted' as const } : t)),
  };
}

function handleCancelTrade(s: GameState, actingPlayerId: string, tradeId: string): GameState {
  const trade = s.tradeOffers.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return s;
  if (trade.fromPlayerId !== actingPlayerId) return s;

  return {
    ...s,
    tradeOffers: s.tradeOffers.map(t => (t.id === tradeId ? { ...t, status: 'cancelled' as const } : t)),
  };
}

function handleBankTrade(s: GameState, actingPlayerId: string, offering: Partial<PlayerResources>, requesting: Partial<PlayerResources>): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;

  const player = s.players[playerIdx];
  if (!canAfford(player.resources, offering)) return s;

  const playerPorts = getPlayerPorts(s, actingPlayerId);
  const hasGenericPort = playerPorts.some(p => p.type === 'any');

  for (const r of ALL_RESOURCES) {
    const offerAmount = (offering as any)[r] || 0;
    if (offerAmount > 0) {
      const hasSpecificPort = playerPorts.some(p => p.type === r);
      let ratio = 4;
      if (hasSpecificPort) ratio = 2;
      else if (hasGenericPort) ratio = 3;

      if (offerAmount % ratio !== 0) return s;
    }
  }

  const players = s.players.map((p, i) => {
    if (i !== playerIdx) return p;
    let res = deductResources(p.resources, offering);
    res = addResources(res, requesting);
    return { ...p, resources: res };
  });

  return { ...s, players };
}

function handleMoveRobber(s: GameState, actingPlayerId: string, hexId: string): GameState {
  if (s.phase !== 'robber_move') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (hexId === s.board.robberHexId) return s;

  const hex = s.board.hexes[hexId];
  if (!hex) return s;

  const newHexes = { ...s.board.hexes };
  newHexes[s.board.robberHexId] = { ...newHexes[s.board.robberHexId], hasRobber: false };
  newHexes[hexId] = { ...newHexes[hexId], hasRobber: true };

  const adjacentPlayerIds = new Set<string>();
  for (const building of s.buildings) {
    const vertex = s.board.vertices[building.vertexId];
    if (vertex && vertex.adjacentHexes.includes(hexId) && building.playerId !== actingPlayerId) {
      if (totalResources(s.players.find(p => p.id === building.playerId)!.resources) > 0) {
        adjacentPlayerIds.add(building.playerId);
      }
    }
  }

  const board = { ...s.board, hexes: newHexes, robberHexId: hexId };

  if (adjacentPlayerIds.size === 0) {
    return { ...s, board, phase: 'main' };
  }

  return { ...s, board, phase: 'robber_steal' };
}

function handleStealResource(s: GameState, actingPlayerId: string, fromPlayerId: string): GameState {
  if (s.phase !== 'robber_steal') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;

  const fromPlayer = s.players.find(p => p.id === fromPlayerId);
  if (!fromPlayer) return s;

  const hasAdjacentBuilding = s.buildings.some(b => {
    if (b.playerId !== fromPlayerId) return false;
    const vertex = s.board.vertices[b.vertexId];
    return vertex && vertex.adjacentHexes.includes(s.board.robberHexId);
  });
  if (!hasAdjacentBuilding) return s;

  const availableResources: Resource[] = [];
  for (const r of ALL_RESOURCES) {
    for (let i = 0; i < fromPlayer.resources[r]; i++) {
      availableResources.push(r);
    }
  }

  if (availableResources.length === 0) {
    return { ...s, phase: 'main' };
  }

  const stolenResource = availableResources[Math.floor(Math.random() * availableResources.length)];

  const players = s.players.map(p => {
    if (p.id === actingPlayerId) {
      return { ...p, resources: { ...p.resources, [stolenResource]: p.resources[stolenResource] + 1 } };
    }
    if (p.id === fromPlayerId) {
      return { ...p, resources: { ...p.resources, [stolenResource]: p.resources[stolenResource] - 1 } };
    }
    return p;
  });

  return { ...s, players, phase: 'main' };
}

function handleDiscardResources(s: GameState, actingPlayerId: string, resources: Partial<PlayerResources>): GameState {
  if (s.phase !== 'robber_discard') return s;
  const required = s.pendingDiscards[actingPlayerId];
  if (!required) return s;

  let discardCount = 0;
  for (const r of ALL_RESOURCES) {
    discardCount += (resources as any)[r] || 0;
  }
  if (discardCount !== required) return s;

  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  const player = s.players[playerIdx];
  if (!canAfford(player.resources, resources)) return s;

  const players = s.players.map((p, i) =>
    i === playerIdx ? { ...p, resources: deductResources(p.resources, resources) } : p
  );

  const pendingDiscards = { ...s.pendingDiscards };
  delete pendingDiscards[actingPlayerId];

  if (Object.keys(pendingDiscards).length === 0) {
    return { ...s, players, pendingDiscards, phase: 'robber_move' };
  }

  return { ...s, players, pendingDiscards };
}

function handleEndTurn(s: GameState, actingPlayerId: string): GameState {
  if (s.phase !== 'main') return s;
  const playerIdx = s.players.findIndex(p => p.id === actingPlayerId);
  if (playerIdx !== s.currentPlayerIndex) return s;
  if (s.diceRoll === null) return s;

  const nextPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;

  const players = s.players.map((p, i) =>
    i === nextPlayerIndex ? { ...p, devCardsPlayedThisTurn: 0 } : p
  );

  const tradeOffers = s.tradeOffers.map(t =>
    t.status === 'open' ? { ...t, status: 'cancelled' as const } : t
  );

  return {
    ...s,
    players,
    currentPlayerIndex: nextPlayerIndex,
    diceRoll: null,
    tradeOffers,
    turnTimer: s.settings.turnTimerSeconds,
  };
}

function handleChat(s: GameState, actingPlayerId: string, text: string): GameState {
  const player = s.players.find(p => p.id === actingPlayerId);
  if (!player) return s;

  return {
    ...s,
    chatMessages: [
      ...s.chatMessages,
      {
        id: uuid(),
        playerId: actingPlayerId,
        playerName: player.name,
        text,
        timestamp: Date.now(),
        type: 'chat',
      },
    ],
  };
}

// ---- Placement Validation ----

function isValidSetupSettlement(s: GameState, vertexId: string): boolean {
  const vertex = s.board.vertices[vertexId];
  if (!vertex) return false;

  if (s.buildings.some(b => b.vertexId === vertexId)) return false;

  for (const adjVId of vertex.adjacentVertices) {
    if (s.buildings.some(b => b.vertexId === adjVId)) return false;
  }

  return true;
}

function isValidSettlementPlacement(s: GameState, playerId: string, vertexId: string): boolean {
  if (!isValidSetupSettlement(s, vertexId)) return false;

  const vertex = s.board.vertices[vertexId];
  const hasConnectedRoad = vertex.adjacentEdges.some(eId =>
    s.roads.some(r => r.edgeId === eId && r.playerId === playerId)
  );

  return hasConnectedRoad;
}

function isValidSetupRoad(s: GameState, playerId: string, edgeId: string): boolean {
  if (s.roads.some(r => r.edgeId === edgeId)) return false;

  const edge = s.board.edges[edgeId];
  if (!edge) return false;

  const lastSettlement = [...s.buildings]
    .filter(b => b.playerId === playerId)
    .pop();
  if (!lastSettlement) return false;

  return edge.vertices.includes(lastSettlement.vertexId);
}

function isValidRoadPlacement(s: GameState, playerId: string, edgeId: string): boolean {
  if (s.roads.some(r => r.edgeId === edgeId)) return false;

  const edge = s.board.edges[edgeId];
  if (!edge) return false;

  for (const vId of edge.vertices) {
    const hasBuilding = s.buildings.some(b => b.vertexId === vId && b.playerId === playerId);
    if (hasBuilding) return true;

    const vertex = s.board.vertices[vId];
    const hasRoad = vertex.adjacentEdges.some(eId =>
      s.roads.some(r => r.edgeId === eId && r.playerId === playerId)
    );

    const enemyBuilding = s.buildings.some(b => b.vertexId === vId && b.playerId !== playerId);
    if (hasRoad && !enemyBuilding) return true;
  }

  return false;
}

// ---- Setup Phase Advancement ----

function advanceSetup(s: GameState): GameState {
  const numPlayers = s.players.length;

  if (s.phase === 'setup_forward') {
    if (s.currentPlayerIndex < numPlayers - 1) {
      return {
        ...s,
        currentPlayerIndex: s.currentPlayerIndex + 1,
        setupSubAction: 'settlement',
      };
    }
    return {
      ...s,
      phase: 'setup_reverse',
      setupRound: 1,
      setupSubAction: 'settlement',
    };
  }

  if (s.phase === 'setup_reverse') {
    if (s.currentPlayerIndex > 0) {
      return {
        ...s,
        currentPlayerIndex: s.currentPlayerIndex - 1,
        setupSubAction: 'settlement',
      };
    }
    return {
      ...s,
      phase: 'main',
      currentPlayerIndex: 0,
      setupSubAction: null,
      diceRoll: null,
      turnTimer: s.settings.turnTimerSeconds,
    };
  }

  return s;
}

// ---- Special Cards (Longest Road / Largest Army) ----

function updateSpecialCards(s: GameState): GameState {
  let longestRoadPlayerId = s.longestRoadPlayerId;
  let longestRoadLength = 4;

  if (longestRoadPlayerId) {
    longestRoadLength = computeLongestRoad(longestRoadPlayerId, s.roads, s.board);
  }

  for (const player of s.players) {
    const len = computeLongestRoad(player.id, s.roads, s.board);
    if (len > longestRoadLength) {
      longestRoadLength = len;
      longestRoadPlayerId = player.id;
    }
  }

  let largestArmyPlayerId = s.largestArmyPlayerId;
  let largestArmySize = 2;

  if (largestArmyPlayerId) {
    largestArmySize = s.players.find(p => p.id === largestArmyPlayerId)!.knightsPlayed;
  }

  for (const player of s.players) {
    if (player.knightsPlayed > largestArmySize) {
      largestArmySize = player.knightsPlayed;
      largestArmyPlayerId = player.id;
    }
  }

  let players = s.players.map(p => ({
    ...p,
    hasLongestRoad: p.id === longestRoadPlayerId,
    hasLargestArmy: p.id === largestArmyPlayerId,
  }));

  s = { ...s, players, longestRoadPlayerId, largestArmyPlayerId };

  players = s.players.map(p => ({
    ...p,
    victoryPoints: calculateVP(p, s.buildings, s.longestRoadPlayerId, s.largestArmyPlayerId),
  }));

  s = { ...s, players };

  const winner = s.players.find(p => p.victoryPoints >= VICTORY_POINTS_TO_WIN);
  if (winner) {
    s = {
      ...s,
      phase: 'game_over',
      winnerId: winner.id,
      chatMessages: [
        ...s.chatMessages,
        {
          id: uuid(),
          playerId: 'system',
          playerName: 'System',
          text: `${winner.name} wins the game!`,
          timestamp: Date.now(),
          type: 'system',
        },
      ],
    };
  }

  return s;
}

// ---- Port Helpers ----

function getPlayerPorts(s: GameState, playerId: string) {
  const playerVertices = new Set(
    s.buildings.filter(b => b.playerId === playerId).map(b => b.vertexId)
  );

  return s.board.ports.filter(port =>
    port.vertices.some(v => playerVertices.has(v))
  );
}

// ---- Exports for validation (used by UI) ----

export function getValidSettlementVertices(s: GameState, playerId: string): string[] {
  const isSetup = s.phase === 'setup_forward' || s.phase === 'setup_reverse';
  return Object.keys(s.board.vertices).filter(vId =>
    isSetup ? isValidSetupSettlement(s, vId) : isValidSettlementPlacement(s, playerId, vId)
  );
}

export function getValidCityVertices(s: GameState, playerId: string): string[] {
  return s.buildings
    .filter(b => b.playerId === playerId && b.type === 'settlement')
    .map(b => b.vertexId);
}

export function getValidRoadEdges(s: GameState, playerId: string): string[] {
  const isSetup = s.phase === 'setup_forward' || s.phase === 'setup_reverse';
  return Object.keys(s.board.edges).filter(eId =>
    isSetup ? isValidSetupRoad(s, playerId, eId) : isValidRoadPlacement(s, playerId, eId)
  );
}

export function getBankTradeRatio(s: GameState, playerId: string, resource: Resource): number {
  const ports = getPlayerPorts(s, playerId);
  if (ports.some(p => p.type === resource)) return 2;
  if (ports.some(p => p.type === 'any')) return 3;
  return 4;
}

export function getStealablePlayerIds(s: GameState, actingPlayerId: string): string[] {
  const ids = new Set<string>();
  for (const building of s.buildings) {
    const vertex = s.board.vertices[building.vertexId];
    if (vertex && vertex.adjacentHexes.includes(s.board.robberHexId) && building.playerId !== actingPlayerId) {
      if (totalResources(s.players.find(p => p.id === building.playerId)!.resources) > 0) {
        ids.add(building.playerId);
      }
    }
  }
  return [...ids];
}
