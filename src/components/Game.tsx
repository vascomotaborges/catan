import React, { useState, useCallback } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import Board from './Board';
import PlayerHUD from './PlayerHUD';
import ChatPanel from './ChatPanel';
import {
  DiscardDialog,
  YearOfPlentyDialog,
  MonopolyDialog,
  StealDialog,
  BankTradeDialog,
  GameOverDialog,
  WaitingDiscardDialog,
} from './Dialogs';
import ReferenceCards from './ReferenceCards';
import type { DevCardType } from '../types';
import {
  getValidSettlementVertices,
  getValidCityVertices,
  getValidRoadEdges,
  getStealablePlayerIds,
} from '../engine/gameEngine';

type BuildMode = 'settlement' | 'city' | 'road' | null;

export default function Game() {
  const { gameState, localPlayerId, dispatch, saveGame, resetGame } =
    useGameStore();

  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [showBankTrade, setShowBankTrade] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!gameState) return null;

  const isMyTurn =
    gameState.players[gameState.currentPlayerIndex]?.id === localPlayerId;
  const isSetup =
    gameState.phase === 'setup_forward' || gameState.phase === 'setup_reverse';

  // Compute valid placements
  let validVertices: string[] = [];
  let validEdges: string[] = [];
  let validHexes: string[] = [];

  if (isMyTurn && isSetup) {
    if (gameState.setupSubAction === 'settlement') {
      validVertices = getValidSettlementVertices(gameState, localPlayerId);
    } else if (gameState.setupSubAction === 'road') {
      validEdges = getValidRoadEdges(gameState, localPlayerId);
    }
  } else if (isMyTurn && gameState.phase === 'main' && gameState.diceRoll) {
    if (buildMode === 'settlement') {
      validVertices = getValidSettlementVertices(gameState, localPlayerId);
    } else if (buildMode === 'city') {
      validVertices = getValidCityVertices(gameState, localPlayerId);
    } else if (buildMode === 'road') {
      validEdges = getValidRoadEdges(gameState, localPlayerId);
    }
  } else if (isMyTurn && gameState.phase === 'road_building') {
    validEdges = getValidRoadEdges(gameState, localPlayerId);
  } else if (isMyTurn && gameState.phase === 'robber_move') {
    validHexes = Object.keys(gameState.board.hexes).filter(
      (id) => id !== gameState.board.robberHexId
    );
  }

  const handleVertexClick = useCallback(
    (vertexId: string) => {
      if (isSetup && gameState.setupSubAction === 'settlement') {
        dispatch({ type: 'build_settlement', vertexId });
      } else if (buildMode === 'settlement') {
        dispatch({ type: 'build_settlement', vertexId });
        setBuildMode(null);
      } else if (buildMode === 'city') {
        dispatch({ type: 'build_city', vertexId });
        setBuildMode(null);
      }
    },
    [dispatch, isSetup, gameState.setupSubAction, buildMode]
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      if (
        isSetup && gameState.setupSubAction === 'road'
      ) {
        dispatch({ type: 'build_road', edgeId });
      } else if (buildMode === 'road' || gameState.phase === 'road_building') {
        dispatch({ type: 'build_road', edgeId });
        if (buildMode === 'road') setBuildMode(null);
      }
    },
    [dispatch, isSetup, gameState.setupSubAction, buildMode, gameState.phase]
  );

  const handleHexClick = useCallback(
    (hexId: string) => {
      if (gameState.phase === 'robber_move') {
        dispatch({ type: 'move_robber', hexId });
      }
    },
    [dispatch, gameState.phase]
  );

  const stealablePlayerIds =
    gameState.phase === 'robber_steal'
      ? getStealablePlayerIds(gameState, localPlayerId)
      : [];

  const needsDiscard =
    gameState.phase === 'robber_discard' &&
    gameState.pendingDiscards[localPlayerId] > 0;

  const waitingForOthersDiscard =
    gameState.phase === 'robber_discard' &&
    !gameState.pendingDiscards[localPlayerId] &&
    Object.keys(gameState.pendingDiscards).length > 0;

  return (
    <div style={styles.gameContainer}>
      {/* Top menu bar */}
      <div style={styles.topBar}>
        <button style={styles.menuBtn} onClick={() => setShowMenu(!showMenu)}>
          ☰
        </button>
        <span style={styles.roomLabel}>
          {useGameStore.getState().roomCode || 'Local Game'}
        </span>
        {isMyTurn && gameState.phase === 'main' && gameState.diceRoll && (
          <button
            style={styles.bankTradeBtn}
            onClick={() => setShowBankTrade(true)}
          >
            🏦 Bank
          </button>
        )}
      </div>

      {/* Menu dropdown */}
      {showMenu && (
        <div style={styles.menuDropdown}>
          <button
            style={styles.menuItem}
            onClick={() => {
              saveGame();
              setShowMenu(false);
            }}
          >
            💾 Save Game
          </button>
          <button
            style={styles.menuItem}
            onClick={() => {
              if (confirm('Leave this game?')) resetGame();
            }}
          >
            🚪 Leave Game
          </button>
        </div>
      )}

      {/* Board */}
      <div style={styles.boardArea}>
        <Board
          gameState={gameState}
          validVertices={validVertices}
          validEdges={validEdges}
          validHexes={validHexes}
          onVertexClick={handleVertexClick}
          onEdgeClick={handleEdgeClick}
          onHexClick={handleHexClick}
        />
        <ReferenceCards />
      </div>

      {/* Player HUD */}
      <PlayerHUD
        gameState={gameState}
        localPlayerId={localPlayerId}
        onBuildSettlement={() => setBuildMode('settlement')}
        onBuildCity={() => setBuildMode('city')}
        onBuildRoad={() => setBuildMode('road')}
        onBuyDevCard={() => dispatch({ type: 'buy_dev_card' })}
        onPlayDevCard={(card) =>
          dispatch({ type: 'play_dev_card', card: card as DevCardType })
        }
        onEndTurn={() => {
          setBuildMode(null);
          dispatch({ type: 'end_turn' });
        }}
        onRollDice={() => dispatch({ type: 'roll_dice' })}
        buildMode={buildMode}
        onCancelBuild={() => setBuildMode(null)}
      />

      {/* Chat & Trade Panel */}
      <ChatPanel
        gameState={gameState}
        localPlayerId={localPlayerId}
        onSendChat={(text) => dispatch({ type: 'send_chat', message: text })}
        onProposeTrade={(offering, requesting) =>
          dispatch({
            type: 'propose_trade',
            offer: { fromPlayerId: localPlayerId, offering, requesting },
          })
        }
        onAcceptTrade={(tradeId) => dispatch({ type: 'accept_trade', tradeId })}
        onDeclineTrade={(tradeId) => dispatch({ type: 'decline_trade', tradeId })}
        onConfirmTrade={(tradeId, withPlayerId) =>
          dispatch({ type: 'confirm_trade', tradeId, withPlayerId })
        }
        onCancelTrade={(tradeId) => dispatch({ type: 'cancel_trade', tradeId })}
      />

      {/* Dialogs */}
      {needsDiscard && (
        <DiscardDialog
          gameState={gameState}
          localPlayerId={localPlayerId}
          onDiscard={(resources) =>
            dispatch({ type: 'discard_resources', resources })
          }
        />
      )}

      {waitingForOthersDiscard && (
        <WaitingDiscardDialog
          gameState={gameState}
          localPlayerId={localPlayerId}
        />
      )}

      {gameState.phase === 'robber_steal' && isMyTurn && stealablePlayerIds.length > 0 && (
        <StealDialog
          gameState={gameState}
          stealablePlayerIds={stealablePlayerIds}
          onSteal={(fromPlayerId) =>
            dispatch({ type: 'steal_resource', fromPlayerId })
          }
        />
      )}

      {gameState.phase === 'year_of_plenty' && isMyTurn && (
        <YearOfPlentyDialog
          picksLeft={gameState.yearOfPlentyPicksLeft}
          onPick={(resource) =>
            dispatch({ type: 'year_of_plenty_pick', resource })
          }
        />
      )}

      {gameState.phase === 'monopoly' && isMyTurn && (
        <MonopolyDialog
          onPick={(resource) =>
            dispatch({ type: 'monopoly_pick', resource })
          }
        />
      )}

      {showBankTrade && (
        <BankTradeDialog
          gameState={gameState}
          localPlayerId={localPlayerId}
          onBankTrade={(offering, requesting) => {
            dispatch({ type: 'bank_trade', offering, requesting });
            setShowBankTrade(false);
          }}
          onClose={() => setShowBankTrade(false)}
        />
      )}

      {gameState.phase === 'game_over' && (
        <GameOverDialog gameState={gameState} onNewGame={resetGame} />
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  gameContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: '#0f3460',
    gap: 10,
    zIndex: 10,
  },
  menuBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#eee',
    fontSize: 20,
    cursor: 'pointer',
  },
  roomLabel: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#f39c12',
    flex: 1,
  },
  bankTradeBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#27ae60',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  menuDropdown: {
    position: 'absolute',
    top: 40,
    left: 10,
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: 8,
    padding: 4,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuItem: {
    padding: '8px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#eee',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left' as const,
    borderRadius: 4,
  },
  boardArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    minHeight: 0,
    position: 'relative',
  },
};
