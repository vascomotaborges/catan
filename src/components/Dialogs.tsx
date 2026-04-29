import React, { useState } from 'react';
import type { GameState, Resource, PlayerResources } from '../types';
import { ALL_RESOURCES, totalResources } from '../types';

const RESOURCE_ICONS: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰️',
};

// ---- Discard Dialog ----

interface DiscardDialogProps {
  gameState: GameState;
  localPlayerId: string;
  onDiscard: (resources: Partial<PlayerResources>) => void;
}

export function DiscardDialog({ gameState, localPlayerId, onDiscard }: DiscardDialogProps) {
  const required = gameState.pendingDiscards[localPlayerId];
  const player = gameState.players.find(p => p.id === localPlayerId);
  if (!required || !player) return null;

  const [selected, setSelected] = useState<Record<Resource, number>>({
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0,
  });

  const totalSelected = ALL_RESOURCES.reduce((sum, r) => sum + selected[r], 0);

  const handleConfirm = () => {
    if (totalSelected === required) {
      onDiscard(selected);
      setSelected({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Discard Resources</h3>
        <p style={styles.dialogText}>
          You have {totalResources(player.resources)} cards. Discard {required} cards.
        </p>
        <div style={styles.resourceRow}>
          {ALL_RESOURCES.map(r => (
            <div key={r} style={styles.resourcePicker}>
              <span style={{ fontSize: 20 }}>{RESOURCE_ICONS[r]}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>have: {player.resources[r]}</span>
              <div style={styles.pickerControls}>
                <button
                  style={styles.pickerBtn}
                  onClick={() => setSelected({ ...selected, [r]: Math.max(0, selected[r] - 1) })}
                >-</button>
                <span style={{ minWidth: 18, textAlign: 'center' as const }}>{selected[r]}</span>
                <button
                  style={styles.pickerBtn}
                  onClick={() =>
                    setSelected({
                      ...selected,
                      [r]: Math.min(player.resources[r], selected[r] + 1),
                    })
                  }
                >+</button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: totalSelected === required ? '#27ae60' : '#e74c3c' }}>
          Selected: {totalSelected} / {required}
        </p>
        <button
          style={{ ...styles.confirmBtn, opacity: totalSelected === required ? 1 : 0.4 }}
          onClick={handleConfirm}
          disabled={totalSelected !== required}
        >
          Confirm Discard
        </button>
      </div>
    </div>
  );
}

// ---- Year of Plenty Dialog ----

interface YearOfPlentyDialogProps {
  picksLeft: number;
  onPick: (resource: Resource) => void;
}

export function YearOfPlentyDialog({ picksLeft, onPick }: YearOfPlentyDialogProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Year of Plenty</h3>
        <p style={styles.dialogText}>
          Pick {picksLeft} resource{picksLeft > 1 ? 's' : ''} from the bank:
        </p>
        <div style={styles.resourceRow}>
          {ALL_RESOURCES.map(r => (
            <button key={r} style={styles.resourceBtn} onClick={() => onPick(r)}>
              <span style={{ fontSize: 24 }}>{RESOURCE_ICONS[r]}</span>
              <span style={{ fontSize: 11 }}>{r}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Monopoly Dialog ----

interface MonopolyDialogProps {
  onPick: (resource: Resource) => void;
}

export function MonopolyDialog({ onPick }: MonopolyDialogProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Monopoly</h3>
        <p style={styles.dialogText}>
          Choose a resource to steal from all players:
        </p>
        <div style={styles.resourceRow}>
          {ALL_RESOURCES.map(r => (
            <button key={r} style={styles.resourceBtn} onClick={() => onPick(r)}>
              <span style={{ fontSize: 24 }}>{RESOURCE_ICONS[r]}</span>
              <span style={{ fontSize: 11 }}>{r}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Steal Dialog ----

interface StealDialogProps {
  gameState: GameState;
  stealablePlayerIds: string[];
  onSteal: (playerId: string) => void;
}

const PLAYER_COLORS_MAP: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};

export function StealDialog({ gameState, stealablePlayerIds, onSteal }: StealDialogProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Steal a Resource</h3>
        <p style={styles.dialogText}>Choose a player to steal from:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {stealablePlayerIds.map(pid => {
            const player = gameState.players.find(p => p.id === pid);
            if (!player) return null;
            return (
              <button
                key={pid}
                style={{
                  ...styles.stealBtn,
                  borderColor: PLAYER_COLORS_MAP[player.color],
                }}
                onClick={() => onSteal(pid)}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: PLAYER_COLORS_MAP[player.color],
                  }}
                />
                <span>{player.name}</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  ({totalResources(player.resources)} cards)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Bank Trade Dialog ----

interface BankTradeDialogProps {
  gameState: GameState;
  localPlayerId: string;
  onBankTrade: (offering: Partial<PlayerResources>, requesting: Partial<PlayerResources>) => void;
  onClose: () => void;
}

export function BankTradeDialog({ gameState, localPlayerId, onBankTrade, onClose }: BankTradeDialogProps) {
  const player = gameState.players.find(p => p.id === localPlayerId);
  if (!player) return null;

  const [giveResource, setGiveResource] = useState<Resource | null>(null);
  const [getResource, setGetResource] = useState<Resource | null>(null);

  const getTradeRatio = (r: Resource): number => {
    const playerVertices = new Set(
      gameState.buildings.filter(b => b.playerId === localPlayerId).map(b => b.vertexId)
    );
    const playerPorts = gameState.board.ports.filter(port =>
      port.vertices.some(v => playerVertices.has(v))
    );
    if (playerPorts.some(p => p.type === r)) return 2;
    if (playerPorts.some(p => p.type === 'any')) return 3;
    return 4;
  };

  const handleTrade = () => {
    if (!giveResource || !getResource || giveResource === getResource) return;
    const ratio = getTradeRatio(giveResource);
    if (player.resources[giveResource] < ratio) return;
    onBankTrade({ [giveResource]: ratio }, { [getResource]: 1 });
    setGiveResource(null);
    setGetResource(null);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Bank Trade</h3>
        <div style={{ marginBottom: 8 }}>
          <p style={styles.dialogText}>Give:</p>
          <div style={styles.resourceRow}>
            {ALL_RESOURCES.map(r => {
              const ratio = getTradeRatio(r);
              const canTrade = player.resources[r] >= ratio;
              return (
                <button
                  key={r}
                  style={{
                    ...styles.resourceBtn,
                    border: giveResource === r ? '2px solid #f39c12' : '2px solid transparent',
                    opacity: canTrade ? 1 : 0.3,
                  }}
                  onClick={() => canTrade && setGiveResource(r)}
                >
                  <span style={{ fontSize: 20 }}>{RESOURCE_ICONS[r]}</span>
                  <span style={{ fontSize: 10 }}>{ratio}:1</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <p style={styles.dialogText}>Receive:</p>
          <div style={styles.resourceRow}>
            {ALL_RESOURCES.map(r => (
              <button
                key={r}
                style={{
                  ...styles.resourceBtn,
                  border: getResource === r ? '2px solid #f39c12' : '2px solid transparent',
                  opacity: giveResource && r !== giveResource ? 1 : 0.3,
                }}
                onClick={() => giveResource && r !== giveResource && setGetResource(r)}
              >
                <span style={{ fontSize: 20 }}>{RESOURCE_ICONS[r]}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            style={{ ...styles.confirmBtn, opacity: giveResource && getResource ? 1 : 0.4 }}
            onClick={handleTrade}
            disabled={!giveResource || !getResource}
          >
            Trade
          </button>
          <button style={{ ...styles.confirmBtn, backgroundColor: '#666' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Game Over Dialog ----

interface GameOverDialogProps {
  gameState: GameState;
  onNewGame: () => void;
}

export function GameOverDialog({ gameState, onNewGame }: GameOverDialogProps) {
  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h2 style={{ ...styles.dialogTitle, fontSize: 24, color: '#f39c12' }}>
          🏆 Game Over!
        </h2>
        <p style={{ fontSize: 18, textAlign: 'center' as const, fontWeight: 'bold' }}>
          {winner?.name} wins with {winner?.victoryPoints} victory points!
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '12px 0' }}>
          {gameState.players
            .sort((a, b) => b.victoryPoints - a.victoryPoints)
            .map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                <span>{i + 1}. {p.name}</span>
                <span style={{ fontWeight: 'bold' }}>{p.victoryPoints} VP</span>
              </div>
            ))}
        </div>
        <button style={styles.confirmBtn} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  );
}

// ---- Waiting for Discards ----

interface WaitingDiscardProps {
  gameState: GameState;
  localPlayerId: string;
}

export function WaitingDiscardDialog({ gameState, localPlayerId }: WaitingDiscardProps) {
  const pendingPlayers = Object.keys(gameState.pendingDiscards)
    .filter(pid => pid !== localPlayerId)
    .map(pid => gameState.players.find(p => p.id === pid)?.name || pid);

  if (pendingPlayers.length === 0) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Waiting for Discards</h3>
        <p style={styles.dialogText}>
          Waiting for: {pendingPlayers.join(', ')}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
  },
  dialog: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    maxWidth: 380,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid #0f3460',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center' as const,
    color: '#eee',
    margin: 0,
  },
  dialogText: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center' as const,
    margin: '4px 0',
  },
  resourceRow: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resourcePicker: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    backgroundColor: '#0f3460',
    borderRadius: 6,
    minWidth: 54,
  },
  pickerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  pickerBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  resourceBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 10px',
    backgroundColor: '#0f3460',
    borderRadius: 8,
    border: '2px solid transparent',
    color: '#eee',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer',
    alignSelf: 'center',
  },
  stealBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    backgroundColor: '#0f3460',
    borderRadius: 8,
    border: '2px solid #333',
    color: '#eee',
    cursor: 'pointer',
    fontSize: 13,
  },
};
