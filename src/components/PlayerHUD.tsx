import React from 'react';
import type { GameState, Player, Resource } from '../types';
import { totalResources, BUILDING_COSTS, ALL_RESOURCES } from '../types';

const PLAYER_COLORS_MAP: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};

const RESOURCE_ICONS: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰️',
};

interface PlayerHUDProps {
  gameState: GameState;
  localPlayerId: string;
  onBuildSettlement: () => void;
  onBuildCity: () => void;
  onBuildRoad: () => void;
  onBuyDevCard: () => void;
  onPlayDevCard: (card: string) => void;
  onEndTurn: () => void;
  onRollDice: () => void;
  buildMode: string | null;
  onCancelBuild: () => void;
}

function canAfford(player: Player, costKey: string): boolean {
  const cost = BUILDING_COSTS[costKey];
  if (!cost) return false;
  for (const r of ALL_RESOURCES) {
    if ((cost[r] || 0) > player.resources[r]) return false;
  }
  return true;
}

export default function PlayerHUD({
  gameState,
  localPlayerId,
  onBuildSettlement,
  onBuildCity,
  onBuildRoad,
  onBuyDevCard,
  onPlayDevCard,
  onEndTurn,
  onRollDice,
  buildMode,
  onCancelBuild,
}: PlayerHUDProps) {
  const localPlayer = gameState.players.find((p) => p.id === localPlayerId);
  if (!localPlayer) return null;

  const isMyTurn =
    gameState.players[gameState.currentPlayerIndex]?.id === localPlayerId;
  const isMainPhase = gameState.phase === 'main';
  const hasRolled = gameState.diceRoll !== null;
  const isSetup =
    gameState.phase === 'setup_forward' || gameState.phase === 'setup_reverse';

  return (
    <div style={styles.container}>
      {/* Current turn indicator */}
      <div style={styles.turnBar}>
        <span style={{ fontWeight: 'bold' }}>
          {isMyTurn ? 'Your Turn' : `${gameState.players[gameState.currentPlayerIndex]?.name}'s Turn`}
        </span>
        {gameState.diceRoll && (
          <span style={styles.diceDisplay}>
            🎲 {gameState.diceRoll[0]} + {gameState.diceRoll[1]} ={' '}
            {gameState.diceRoll[0] + gameState.diceRoll[1]}
          </span>
        )}
      </div>

      {/* Resource hand */}
      <div style={styles.resources}>
        {ALL_RESOURCES.map((r) => (
          <div key={r} style={styles.resourceItem}>
            <span style={styles.resourceIcon}>{RESOURCE_ICONS[r]}</span>
            <span style={styles.resourceCount}>{localPlayer.resources[r]}</span>
          </div>
        ))}
      </div>

      {/* Dev cards */}
      {localPlayer.devCards.length > 0 && (
        <div style={styles.devCards}>
          <span style={{ fontSize: 12, color: '#aaa' }}>Dev Cards:</span>
          <div style={styles.devCardList}>
            {localPlayer.devCards.map((card, i) => (
              <button
                key={`${card}-${i}`}
                style={{
                  ...styles.devCardBtn,
                  opacity:
                    isMyTurn &&
                    isMainPhase &&
                    hasRolled &&
                    card !== 'victory_point' &&
                    localPlayer.devCardsPlayedThisTurn < 1
                      ? 1
                      : 0.5,
                }}
                onClick={() => onPlayDevCard(card)}
                disabled={
                  !isMyTurn ||
                  !isMainPhase ||
                  !hasRolled ||
                  card === 'victory_point' ||
                  localPlayer.devCardsPlayedThisTurn >= 1
                }
              >
                {formatDevCard(card)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Build mode indicator */}
      {buildMode && (
        <div style={styles.buildModeBar}>
          <span>Placing: {buildMode}</span>
          <button style={styles.cancelBtn} onClick={onCancelBuild}>
            Cancel
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        {isMyTurn && isMainPhase && !hasRolled && (
          <button style={styles.actionBtn} onClick={onRollDice}>
            🎲 Roll Dice
          </button>
        )}

        {isMyTurn && isMainPhase && hasRolled && !buildMode && (
          <>
            <button
              style={{
                ...styles.actionBtn,
                opacity: canAfford(localPlayer, 'road') ? 1 : 0.4,
              }}
              onClick={onBuildRoad}
              disabled={!canAfford(localPlayer, 'road')}
            >
              🛤️ Road
            </button>
            <button
              style={{
                ...styles.actionBtn,
                opacity: canAfford(localPlayer, 'settlement') ? 1 : 0.4,
              }}
              onClick={onBuildSettlement}
              disabled={!canAfford(localPlayer, 'settlement')}
            >
              🏠 Settle
            </button>
            <button
              style={{
                ...styles.actionBtn,
                opacity: canAfford(localPlayer, 'city') ? 1 : 0.4,
              }}
              onClick={onBuildCity}
              disabled={!canAfford(localPlayer, 'city')}
            >
              🏙️ City
            </button>
            <button
              style={{
                ...styles.actionBtn,
                opacity: canAfford(localPlayer, 'dev_card') ? 1 : 0.4,
              }}
              onClick={onBuyDevCard}
              disabled={!canAfford(localPlayer, 'dev_card')}
            >
              🃏 Dev Card
            </button>
            <button
              style={{ ...styles.actionBtn, backgroundColor: '#e74c3c' }}
              onClick={onEndTurn}
            >
              End Turn
            </button>
          </>
        )}

        {isMyTurn && isSetup && (
          <div style={styles.setupHint}>
            {gameState.setupSubAction === 'settlement'
              ? 'Place a settlement on the board'
              : 'Place a road connected to your settlement'}
          </div>
        )}
      </div>

      {/* Other players summary */}
      <div style={styles.otherPlayers}>
        {gameState.players
          .filter((p) => p.id !== localPlayerId)
          .map((p) => (
            <div key={p.id} style={styles.otherPlayerRow}>
              <div
                style={{
                  ...styles.colorDot,
                  backgroundColor: PLAYER_COLORS_MAP[p.color],
                }}
              />
              <span style={styles.otherName}>{p.name}</span>
              <span style={styles.otherInfo}>
                🃏{totalResources(p.resources)} | VP:{p.victoryPoints}
                {p.hasLongestRoad ? ' | 🛤️' : ''}
                {p.hasLargestArmy ? ' | ⚔️' : ''}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function formatDevCard(card: string): string {
  switch (card) {
    case 'knight':
      return '⚔️ Knight';
    case 'road_building':
      return '🛤️ Roads';
    case 'year_of_plenty':
      return '🎁 Plenty';
    case 'monopoly':
      return '💰 Monopoly';
    case 'victory_point':
      return '⭐ VP';
    default:
      return card;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    backgroundColor: '#16213e',
    borderTop: '2px solid #0f3460',
  },
  turnBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
    fontSize: 14,
  },
  diceDisplay: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f39c12',
  },
  resources: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: 4,
  },
  resourceItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 8px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
    minWidth: 44,
  },
  resourceIcon: { fontSize: 20 },
  resourceCount: { fontSize: 16, fontWeight: 'bold' },
  devCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  devCardList: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  devCardBtn: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #333',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: 11,
    cursor: 'pointer',
  },
  buildModeBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: '#e67e2233',
    borderRadius: 6,
    border: '1px solid #e67e22',
    fontSize: 13,
  },
  cancelBtn: {
    padding: '2px 10px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#e74c3c',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: '1 1 auto',
    maxWidth: 100,
    textAlign: 'center' as const,
  },
  setupHint: {
    textAlign: 'center' as const,
    color: '#f39c12',
    fontSize: 14,
    fontWeight: 'bold',
    padding: '8px 0',
  },
  otherPlayers: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  otherPlayerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    backgroundColor: '#0f3460',
    borderRadius: 4,
    fontSize: 12,
    flex: '1 1 auto',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  otherName: { fontWeight: 'bold' },
  otherInfo: { color: '#aaa', fontSize: 11 },
};
