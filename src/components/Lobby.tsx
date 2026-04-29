import React, { useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import type { GameSettings } from '../types';

const PLAYER_COLORS_MAP: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};

export default function Lobby() {
  const {
    localPlayerName,
    setPlayerName,
    hostGame,
    joinGame,
    gameState,
    roomCode,
    error,
    clearError,
    dispatch,
    localPlayerId,
    hasSavedGame,
    loadGame,
    connectionStatus,
  } = useGameStore();

  const [nameInput, setNameInput] = useState(localPlayerName);
  const [joinCode, setJoinCode] = useState('');
  const [timerSetting, setTimerSetting] = useState(120);
  const [view, setView] = useState<'menu' | 'host' | 'join'>('menu');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetName = () => {
    if (nameInput.trim()) {
      setPlayerName(nameInput.trim());
    }
  };

  const handleHost = async () => {
    handleSetName();
    if (!nameInput.trim()) return;
    setIsLoading(true);
    try {
      const settings: GameSettings = {
        turnTimerSeconds: timerSetting,
        maxPlayers: 4,
      };
      await hostGame(settings);
    } catch {
      // error handled in store
    }
    setIsLoading(false);
  };

  const handleJoin = async () => {
    handleSetName();
    if (!nameInput.trim() || !joinCode.trim()) return;
    setIsLoading(true);
    try {
      await joinGame(joinCode.trim());
    } catch {
      // error handled in store
    }
    setIsLoading(false);
  };

  const handleStartGame = () => {
    dispatch({ type: 'start_game' });
  };

  const isHost = useGameStore.getState().peerManager?.isHost ?? false;

  if (gameState && gameState.phase === 'lobby' && roomCode) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Settlers of Catan</h1>
        <div style={styles.card}>
          <h2 style={styles.subtitle}>Room: {roomCode}</h2>
          <p style={styles.hint}>Share this code with other players</p>

          <div style={styles.playerList}>
            <h3 style={{ margin: '8px 0' }}>Players ({gameState.players.length}/4)</h3>
            {gameState.players.map((p) => (
              <div key={p.id} style={styles.playerRow}>
                <div
                  style={{
                    ...styles.colorDot,
                    backgroundColor: PLAYER_COLORS_MAP[p.color],
                  }}
                />
                <span>
                  {p.name}
                  {p.id === localPlayerId ? ' (you)' : ''}
                </span>
              </div>
            ))}
            {Array.from({ length: 4 - gameState.players.length }).map((_, i) => (
              <div key={`empty-${i}`} style={styles.playerRow}>
                <div style={{ ...styles.colorDot, backgroundColor: '#333' }} />
                <span style={{ color: '#666' }}>Waiting...</span>
              </div>
            ))}
          </div>

          {isHost && gameState.players.length >= 2 && (
            <button style={styles.button} onClick={handleStartGame}>
              Start Game
            </button>
          )}

          {isHost && gameState.players.length < 2 && (
            <p style={styles.hint}>Need at least 2 players to start</p>
          )}

          {!isHost && (
            <p style={styles.hint}>Waiting for host to start the game...</p>
          )}
        </div>
        {error && (
          <div style={styles.error}>
            {error}
            <button style={styles.errorClose} onClick={clearError}>×</button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'menu') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Settlers of Catan</h1>
        <div style={styles.card}>
          <label style={styles.label}>Your Name</label>
          <input
            style={styles.input}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />

          <button
            style={styles.button}
            onClick={() => {
              handleSetName();
              if (nameInput.trim()) setView('host');
            }}
          >
            Host Game
          </button>

          <button
            style={{ ...styles.button, backgroundColor: '#3498db' }}
            onClick={() => {
              handleSetName();
              if (nameInput.trim()) setView('join');
            }}
          >
            Join Game
          </button>

          {hasSavedGame && (
            <button
              style={{ ...styles.button, backgroundColor: '#27ae60' }}
              onClick={loadGame}
            >
              Resume Saved Game
            </button>
          )}
        </div>
        {error && (
          <div style={styles.error}>
            {error}
            <button style={styles.errorClose} onClick={clearError}>×</button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'host') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Host Game</h1>
        <div style={styles.card}>
          <label style={styles.label}>Turn Timer (seconds)</label>
          <input
            style={styles.input}
            type="number"
            value={timerSetting}
            onChange={(e) => setTimerSetting(Number(e.target.value))}
            min={30}
            max={600}
          />

          <button
            style={styles.button}
            onClick={handleHost}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Room...' : 'Create Room'}
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#666' }}
            onClick={() => setView('menu')}
          >
            Back
          </button>
        </div>
        {error && (
          <div style={styles.error}>
            {error}
            <button style={styles.errorClose} onClick={clearError}>×</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Join Game</h1>
      <div style={styles.card}>
        <label style={styles.label}>Room Code</label>
        <input
          style={styles.input}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="CATAN-XXXX"
          maxLength={10}
        />

        <button
          style={styles.button}
          onClick={handleJoin}
          disabled={isLoading}
        >
          {isLoading
            ? connectionStatus === 'connecting-to-server'
              ? 'Connecting to server...'
              : connectionStatus === 'connecting-to-host'
                ? 'Reaching host...'
                : 'Joining...'
            : 'Join'}
        </button>
        <button
          style={{ ...styles.button, backgroundColor: '#666' }}
          onClick={() => setView('menu')}
        >
          Back
        </button>
      </div>
      {error && (
        <div style={styles.error}>
          <span style={{ flex: 1 }}>{error}</span>
          {view === 'join' && joinCode.trim() && (
            <button style={styles.retryBtn} onClick={handleJoin}>Retry</button>
          )}
          <button style={styles.errorClose} onClick={clearError}>×</button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    padding: 16,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#e67e22',
  },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#f39c12',
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: -8,
  },
  input: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #333',
    backgroundColor: '#0f3460',
    color: '#eee',
    fontSize: 16,
    outline: 'none',
  },
  button: {
    padding: '12px 20px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center' as const,
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    margin: '8px 0',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid #fff3',
  },
  error: {
    marginTop: 16,
    padding: '10px 16px',
    backgroundColor: '#e74c3c33',
    border: '1px solid #e74c3c',
    borderRadius: 8,
    color: '#e74c3c',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    maxWidth: 400,
    width: '100%',
  },
  retryBtn: {
    padding: '4px 12px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#e74c3c',
    fontSize: 20,
    cursor: 'pointer',
  },
};
