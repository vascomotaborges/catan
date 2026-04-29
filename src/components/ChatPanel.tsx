import React, { useState, useRef, useEffect } from 'react';
import type { GameState, Resource, TradeOffer } from '../types';
import { ALL_RESOURCES } from '../types';

const RESOURCE_ICONS: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '🪨',
};

const PLAYER_COLORS_MAP: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};

interface ChatPanelProps {
  gameState: GameState;
  localPlayerId: string;
  onSendChat: (text: string) => void;
  onProposeTrade: (offering: Partial<Record<Resource, number>>, requesting: Partial<Record<Resource, number>>) => void;
  onAcceptTrade: (tradeId: string) => void;
  onDeclineTrade: (tradeId: string) => void;
  onConfirmTrade: (tradeId: string, withPlayerId: string) => void;
  onCancelTrade: (tradeId: string) => void;
}

export default function ChatPanel({
  gameState,
  localPlayerId,
  onSendChat,
  onProposeTrade,
  onAcceptTrade,
  onDeclineTrade,
  onConfirmTrade,
  onCancelTrade,
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'trade'>('chat');
  const [tradeOffering, setTradeOffering] = useState<Record<Resource, number>>({
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0,
  });
  const [tradeRequesting, setTradeRequesting] = useState<Record<Resource, number>>({
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.chatMessages.length]);

  const handleSendChat = () => {
    if (chatInput.trim()) {
      onSendChat(chatInput.trim());
      setChatInput('');
    }
  };

  const handleProposeTrade = () => {
    const hasOffering = ALL_RESOURCES.some(r => tradeOffering[r] > 0);
    const hasRequesting = ALL_RESOURCES.some(r => tradeRequesting[r] > 0);
    if (!hasOffering || !hasRequesting) return;
    onProposeTrade(tradeOffering, tradeRequesting);
    setTradeOffering({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    setTradeRequesting({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  };

  const openTrades = gameState.tradeOffers.filter(t => t.status === 'open');
  const localPlayer = gameState.players.find(p => p.id === localPlayerId);

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'chat' ? styles.activeTab : {}) }}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'trade' ? styles.activeTab : {}) }}
          onClick={() => setTab('trade')}
        >
          Trade {openTrades.length > 0 && `(${openTrades.length})`}
        </button>
      </div>

      {tab === 'chat' ? (
        <div style={styles.chatContent}>
          <div style={styles.messages}>
            {gameState.chatMessages.slice(-50).map((msg) => {
              const player = gameState.players.find(p => p.id === msg.playerId);
              const color = player ? PLAYER_COLORS_MAP[player.color] : '#888';
              return (
                <div key={msg.id} style={styles.message}>
                  <span style={{ color, fontWeight: 'bold', fontSize: 12 }}>
                    {msg.type === 'system' ? '⚙️' : msg.playerName}:
                  </span>{' '}
                  <span style={{ fontSize: 12 }}>{msg.text}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div style={styles.inputRow}>
            <input
              style={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Type a message..."
              maxLength={200}
            />
            <button style={styles.sendBtn} onClick={handleSendChat}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.tradeContent}>
          {/* Active trades */}
          {openTrades.length > 0 && (
            <div style={styles.tradeList}>
              {openTrades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  gameState={gameState}
                  localPlayerId={localPlayerId}
                  onAccept={onAcceptTrade}
                  onDecline={onDeclineTrade}
                  onConfirm={onConfirmTrade}
                  onCancel={onCancelTrade}
                />
              ))}
            </div>
          )}

          {/* New trade form */}
          <div style={styles.tradeForm}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#f39c12' }}>
              Propose Trade
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>I give:</div>
            <ResourcePicker
              values={tradeOffering}
              onChange={setTradeOffering}
              max={localPlayer?.resources}
            />
            <div style={{ fontSize: 11, color: '#aaa' }}>I want:</div>
            <ResourcePicker
              values={tradeRequesting}
              onChange={setTradeRequesting}
            />
            <button style={styles.tradeBtn} onClick={handleProposeTrade}>
              Propose
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourcePicker({
  values,
  onChange,
  max,
}: {
  values: Record<Resource, number>;
  onChange: (v: Record<Resource, number>) => void;
  max?: Record<Resource, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {ALL_RESOURCES.map((r) => {
        const maxVal = max ? max[r] : 99;
        return (
          <div key={r} style={styles.pickerItem}>
            <span style={{ fontSize: 16 }}>{RESOURCE_ICONS[r]}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                style={styles.pickerBtn}
                onClick={() =>
                  onChange({ ...values, [r]: Math.max(0, values[r] - 1) })
                }
              >
                -
              </button>
              <span style={{ fontSize: 13, minWidth: 14, textAlign: 'center' as const }}>
                {values[r]}
              </span>
              <button
                style={styles.pickerBtn}
                onClick={() =>
                  onChange({
                    ...values,
                    [r]: Math.min(maxVal, values[r] + 1),
                  })
                }
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeCard({
  trade,
  gameState,
  localPlayerId,
  onAccept,
  onDecline,
  onConfirm,
  onCancel,
}: {
  trade: TradeOffer;
  gameState: GameState;
  localPlayerId: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onConfirm: (id: string, withPlayerId: string) => void;
  onCancel: (id: string) => void;
}) {
  const fromPlayer = gameState.players.find((p) => p.id === trade.fromPlayerId);
  const isMyTrade = trade.fromPlayerId === localPlayerId;
  const hasAccepted = trade.acceptedBy.includes(localPlayerId);

  return (
    <div style={styles.tradeCard}>
      <div style={{ fontSize: 12, fontWeight: 'bold' }}>
        {fromPlayer?.name || 'Unknown'} offers:
      </div>
      <div style={styles.tradeResources}>
        <span style={{ fontSize: 11, color: '#e74c3c' }}>Gives: </span>
        {ALL_RESOURCES.filter((r) => (trade.offering[r] || 0) > 0).map((r) => (
          <span key={r} style={{ fontSize: 12 }}>
            {RESOURCE_ICONS[r]}×{trade.offering[r]}
          </span>
        ))}
      </div>
      <div style={styles.tradeResources}>
        <span style={{ fontSize: 11, color: '#27ae60' }}>Wants: </span>
        {ALL_RESOURCES.filter((r) => (trade.requesting[r] || 0) > 0).map((r) => (
          <span key={r} style={{ fontSize: 12 }}>
            {RESOURCE_ICONS[r]}×{trade.requesting[r]}
          </span>
        ))}
      </div>

      {isMyTrade ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {trade.acceptedBy.map((pid) => {
            const p = gameState.players.find((pl) => pl.id === pid);
            return (
              <button
                key={pid}
                style={{ ...styles.tradeActionBtn, backgroundColor: '#27ae60' }}
                onClick={() => onConfirm(trade.id, pid)}
              >
                Trade with {p?.name}
              </button>
            );
          })}
          <button
            style={{ ...styles.tradeActionBtn, backgroundColor: '#e74c3c' }}
            onClick={() => onCancel(trade.id)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {!hasAccepted && (
            <button
              style={{ ...styles.tradeActionBtn, backgroundColor: '#27ae60' }}
              onClick={() => onAccept(trade.id)}
            >
              Accept
            </button>
          )}
          {hasAccepted && (
            <span style={{ fontSize: 11, color: '#27ae60' }}>Accepted ✓</span>
          )}
          <button
            style={{ ...styles.tradeActionBtn, backgroundColor: '#e74c3c' }}
            onClick={() => onDecline(trade.id)}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#16213e',
    borderTop: '1px solid #0f3460',
    maxHeight: 280,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #0f3460',
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  activeTab: {
    color: '#f39c12',
    borderBottom: '2px solid #f39c12',
  },
  chatContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px',
    maxHeight: 180,
  },
  message: {
    padding: '2px 0',
    lineHeight: 1.3,
  },
  inputRow: {
    display: 'flex',
    gap: 4,
    padding: 6,
  },
  chatInput: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #333',
    backgroundColor: '#0f3460',
    color: '#eee',
    fontSize: 13,
    outline: 'none',
  },
  sendBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  tradeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    overflowY: 'auto',
    maxHeight: 240,
  },
  tradeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  tradeCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: 8,
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  tradeResources: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  tradeActionBtn: {
    padding: '3px 10px',
    borderRadius: 4,
    border: 'none',
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  tradeForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  pickerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  pickerBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  tradeBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#e67e22',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
    alignSelf: 'center',
  },
};
