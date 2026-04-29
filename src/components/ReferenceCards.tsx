import React, { useState } from 'react';

type CardType = 'costs' | 'devCards' | 'scoring' | null;

const TABS: { id: CardType; label: string; title: string }[] = [
  { id: 'costs', label: '🏗️', title: 'Costs' },
  { id: 'devCards', label: '🃏', title: 'Cards' },
  { id: 'scoring', label: '⭐', title: 'Score' },
];

export default function ReferenceCards() {
  const [open, setOpen] = useState<CardType>(null);
  const [closing, setClosing] = useState(false);

  const toggle = (id: CardType) => {
    if (open === id) {
      handleClose();
    } else if (open) {
      setClosing(true);
      setTimeout(() => {
        setClosing(false);
        setOpen(id);
      }, 200);
    } else {
      setOpen(id);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setOpen(null);
    }, 200);
  };

  return (
    <>
      <style>{ANIM_CSS}</style>

      {open && (
        <div style={styles.backdrop} onClick={handleClose} />
      )}

      {!open && <div style={styles.tabStrip}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(open === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => toggle(tab.id)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.label}</span>
            <span style={{ fontSize: 9, lineHeight: 1 }}>{tab.title}</span>
          </button>
        ))}
      </div>}

      {open && (
        <div
          style={styles.panel}
          className={closing ? 'refcard-slide-down' : 'refcard-slide-up'}
        >
          <div style={styles.panelHeader}>
            <div style={styles.panelTabs}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  style={{
                    ...styles.panelTab,
                    ...(open === tab.id ? styles.panelTabActive : {}),
                  }}
                  onClick={() => {
                    setOpen(tab.id);
                  }}
                >
                  {tab.label} {tab.title}
                </button>
              ))}
            </div>
            <button style={styles.closeBtn} onClick={handleClose}>×</button>
          </div>
          <div style={styles.panelBody}>
            {open === 'costs' && <CostsCard />}
            {open === 'devCards' && <DevCardsCard />}
            {open === 'scoring' && <ScoringCard />}
          </div>
        </div>
      )}
    </>
  );
}

// ---- Animation CSS ----

const ANIM_CSS = `
@keyframes refcard-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes refcard-down {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
.refcard-slide-up {
  animation: refcard-up 0.25s ease-out forwards;
}
.refcard-slide-down {
  animation: refcard-down 0.2s ease-in forwards;
}
`;

// ---- Building Costs Card ----

function CostsCard() {
  return (
    <div style={styles.cardContent}>
      <p style={styles.cardTitle}>Building Costs</p>
      <div style={styles.costRow}>
        <span style={styles.costLabel}>🛤️ Road</span>
        <span style={styles.costResources}>🪵 1 &nbsp; 🧱 1</span>
      </div>
      <div style={styles.costRow}>
        <span style={styles.costLabel}>🏠 Settlement</span>
        <span style={styles.costResources}>🪵 1 &nbsp; 🧱 1 &nbsp; 🐑 1 &nbsp; 🌾 1</span>
      </div>
      <div style={styles.costRow}>
        <span style={styles.costLabel}>🏙️ City</span>
        <span style={styles.costResources}>🌾 2 &nbsp; 🪨 3</span>
      </div>
      <div style={styles.costRow}>
        <span style={styles.costLabel}>🃏 Dev Card</span>
        <span style={styles.costResources}>🐑 1 &nbsp; 🌾 1 &nbsp; 🪨 1</span>
      </div>
    </div>
  );
}

// ---- Development Cards Card ----

function DevCardsCard() {
  return (
    <div style={styles.cardContent}>
      <p style={styles.cardTitle}>Development Cards</p>
      <div style={styles.devRow}>
        <span style={styles.devName}>⚔️ Knight <span style={styles.devCount}>×14</span></span>
        <span style={styles.devDesc}>Move the robber and steal 1 resource from an adjacent player.</span>
      </div>
      <div style={styles.devRow}>
        <span style={styles.devName}>🛤️ Road Building <span style={styles.devCount}>×2</span></span>
        <span style={styles.devDesc}>Place 2 roads for free.</span>
      </div>
      <div style={styles.devRow}>
        <span style={styles.devName}>🎁 Year of Plenty <span style={styles.devCount}>×2</span></span>
        <span style={styles.devDesc}>Take any 2 resources from the bank.</span>
      </div>
      <div style={styles.devRow}>
        <span style={styles.devName}>💰 Monopoly <span style={styles.devCount}>×2</span></span>
        <span style={styles.devDesc}>Name a resource — all players give you theirs.</span>
      </div>
      <div style={styles.devRow}>
        <span style={styles.devName}>⭐ Victory Point <span style={styles.devCount}>×5</span></span>
        <span style={styles.devDesc}>Worth 1 VP. Kept secret until you win.</span>
      </div>
    </div>
  );
}

// ---- Scoring / How to Win Card ----

function ScoringCard() {
  return (
    <div style={styles.cardContent}>
      <p style={styles.winTarget}>First to <strong>10 Victory Points</strong> wins!</p>
      <div style={styles.scoreRow}>
        <span style={styles.scoreSource}>🏠 Settlement</span>
        <span style={styles.scoreVP}>1 VP</span>
      </div>
      <div style={styles.scoreRow}>
        <span style={styles.scoreSource}>🏙️ City</span>
        <span style={styles.scoreVP}>2 VP</span>
      </div>
      <div style={styles.scoreRow}>
        <span style={styles.scoreSource}>🛤️ Longest Road</span>
        <span style={styles.scoreVP}>2 VP</span>
      </div>
      <p style={styles.scoreNote}>5+ connected roads, more than any other player.</p>
      <div style={styles.scoreRow}>
        <span style={styles.scoreSource}>⚔️ Largest Army</span>
        <span style={styles.scoreVP}>2 VP</span>
      </div>
      <p style={styles.scoreNote}>3+ knights played, more than any other player.</p>
      <div style={styles.scoreRow}>
        <span style={styles.scoreSource}>⭐ VP Dev Cards</span>
        <span style={styles.scoreVP}>1 VP each</span>
      </div>
    </div>
  );
}

// ---- Styles ----

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 49,
  },
  tabStrip: {
    position: 'absolute',
    right: 8,
    bottom: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    zIndex: 51,
  },
  tab: {
    width: 42,
    height: 32,
    border: 'none',
    borderRadius: '6px 6px 0 0',
    backgroundColor: '#16213e',
    color: '#eee',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 -2px 6px rgba(0,0,0,0.3)',
    padding: '2px 0 0',
    gap: 0,
  },
  tabActive: {
    backgroundColor: '#e67e22',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: '#16213e',
    borderTop: '2px solid #0f3460',
    borderRadius: '12px 12px 0 0',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    borderBottom: '1px solid #0f3460',
    flexShrink: 0,
  },
  panelTabs: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  panelTab: {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  panelTabActive: {
    backgroundColor: '#e67e22',
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  panelBody: {
    overflowY: 'auto',
    padding: '10px 12px 14px',
    flex: 1,
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  // Costs card
  costRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  costLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  costResources: {
    fontSize: 13,
  },

  // Dev cards card
  devRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 10px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  devName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  devCount: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: 'normal',
  },
  devDesc: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: '1.3',
  },

  // Scoring card
  winTarget: {
    fontSize: 16,
    textAlign: 'center' as const,
    color: '#eee',
    margin: '0 0 4px',
  },
  scoreRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: '#0f3460',
    borderRadius: 6,
  },
  scoreSource: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scoreVP: {
    fontSize: 14,
    color: '#f39c12',
    fontWeight: 'bold',
  },
  scoreNote: {
    fontSize: 11,
    color: '#888',
    margin: '-4px 0 0 10px',
    fontStyle: 'italic',
  },
};
