import { useEffect } from 'react';
import { useGameStore } from './hooks/useGameStore';
import Lobby from './components/Lobby';
import Game from './components/Game';

function App() {
  const { gameState, joinGame, localPlayerName, setPlayerName } = useGameStore();

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#\/join\/(.+)$/);
    if (match) {
      const roomCode = match[1];
      const name = localPlayerName || `Player_${Math.random().toString(36).slice(2, 6)}`;
      if (!localPlayerName) setPlayerName(name);
      joinGame(roomCode).catch(() => {});
      window.location.hash = '';
    }
  }, []);

  const isInGame =
    gameState &&
    gameState.phase !== 'lobby';

  if (isInGame) {
    return <Game />;
  }

  return <Lobby />;
}

export default App;
