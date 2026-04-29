import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  GameState,
  GameAction,
  NetworkMessage,
  GameSettings,
} from '../types';
import { createInitialState, applyAction } from '../engine/gameEngine';
import { PeerManager } from '../network/peer';

const STORAGE_KEY = 'catan_saved_game';

// ---- Persistence helpers ----

function saveToStorage(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

function loadFromStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---- Store types ----

export type ConnectionStatus =
  | 'idle'
  | 'connecting-to-server'
  | 'connecting-to-host'
  | 'connected'
  | 'reconnecting';

export interface GameStore {
  // State
  gameState: GameState | null;
  localPlayerId: string;
  localPlayerName: string;
  peerManager: PeerManager | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  roomCode: string | null;
  error: string | null;
  hasSavedGame: boolean;

  // Actions
  setPlayerName: (name: string) => void;
  hostGame: (settings: GameSettings) => Promise<string>;
  joinGame: (roomCode: string) => Promise<void>;
  dispatch: (action: GameAction) => void;
  saveGame: () => void;
  loadGame: () => void;
  resetGame: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const localPlayerId = localStorage.getItem('catan_player_id') || uuid();
  localStorage.setItem('catan_player_id', localPlayerId);

  return {
    gameState: null,
    localPlayerId,
    localPlayerName: localStorage.getItem('catan_player_name') || '',
    peerManager: null,
    isConnected: false,
    connectionStatus: 'idle' as ConnectionStatus,
    roomCode: null,
    error: null,
    hasSavedGame: loadFromStorage() !== null,

    setPlayerName: (name: string) => {
      localStorage.setItem('catan_player_name', name);
      set({ localPlayerName: name });
    },

    hostGame: async (settings: GameSettings) => {
      const { localPlayerId, localPlayerName, peerManager: oldPm } = get();
      if (oldPm) oldPm.disconnect();

      const pm = new PeerManager();
      const state = createInitialState(settings);

      const joinedState = applyAction(state, {
        type: 'join',
        playerId: localPlayerId,
        playerName: localPlayerName,
      }, localPlayerId);

      set({
        peerManager: pm,
        gameState: joinedState,
        error: null,
      });

      pm.setStateProvider(() => get().gameState);

      pm.onMessage((message: NetworkMessage) => {
        const { gameState } = get();
        if (!gameState) return;

        if (message.type === 'action') {
          const newState = applyAction(gameState, message.action, message.playerId);
          set({ gameState: newState });
          pm.broadcast({ type: 'state_sync', state: newState });
        }
      });

      pm.onPlayerConnected(() => {
        // state sync is handled automatically by PeerManager
      });

      pm.onPlayerDisconnected((disconnectedPeerId: string) => {
        pm.broadcast({
          type: 'player_disconnected',
          playerId: disconnectedPeerId,
        });
      });

      try {
        set({ connectionStatus: 'connecting-to-server' });
        const roomCode = await pm.hostRoom();
        set({ roomCode, isConnected: true, connectionStatus: 'connected' });
        return roomCode;
      } catch (err: any) {
        set({ error: `Failed to create room: ${err.message || err}`, connectionStatus: 'idle' });
        throw err;
      }
    },

    joinGame: async (roomCode: string) => {
      const { localPlayerId, localPlayerName, peerManager: oldPm } = get();
      if (oldPm) oldPm.disconnect();

      const pm = new PeerManager();
      set({ peerManager: pm, error: null });

      pm.onMessage((message: NetworkMessage) => {
        if (message.type === 'state_sync') {
          set({ gameState: message.state });
        } else if (message.type === 'error') {
          set({ error: message.message });
        }
      });

      pm.onPlayerDisconnected(() => {
        set({ error: 'Lost connection to host. Attempting to reconnect...', connectionStatus: 'reconnecting' });
      });

      pm.onPlayerConnected(() => {
        set({ error: null, isConnected: true, connectionStatus: 'connected' });
      });

      try {
        await pm.joinRoom(
          roomCode.toUpperCase(),
          localPlayerName,
          (status) => set({ connectionStatus: status }),
        );
        set({ roomCode, isConnected: true, connectionStatus: 'connected' });

        pm.sendToHost({
          type: 'action',
          action: {
            type: 'join',
            playerId: localPlayerId,
            playerName: localPlayerName,
          },
          playerId: localPlayerId,
        });
      } catch (err: any) {
        set({ error: err.message || String(err), connectionStatus: 'idle' });
        throw err;
      }
    },

    dispatch: (action: GameAction) => {
      const { peerManager, gameState, localPlayerId } = get();
      if (!peerManager || !gameState) return;

      if (peerManager.isHost) {
        const newState = applyAction(gameState, action, localPlayerId);
        set({ gameState: newState });
        peerManager.broadcast({ type: 'state_sync', state: newState });
      } else {
        peerManager.sendToHost({
          type: 'action',
          action,
          playerId: localPlayerId,
        });
      }
    },

    saveGame: () => {
      const { gameState } = get();
      if (gameState) {
        saveToStorage(gameState);
        set({ hasSavedGame: true });
      }
    },

    loadGame: () => {
      const saved = loadFromStorage();
      if (saved) {
        set({ gameState: saved });
      }
    },

    resetGame: () => {
      const { peerManager } = get();
      if (peerManager) peerManager.disconnect();
      clearSavedGame();
      set({
        gameState: null,
        peerManager: null,
        isConnected: false,
        connectionStatus: 'idle' as ConnectionStatus,
        roomCode: null,
        error: null,
        hasSavedGame: false,
      });
    },

    clearError: () => set({ error: null }),
  };
});
