import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetworkMessage, GameState } from '../types';

// ---------------------------------------------------------------------------
// Room-code helpers
// ---------------------------------------------------------------------------

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `CATAN-${code}`;
}

// ---------------------------------------------------------------------------
// Reconnection config
// ---------------------------------------------------------------------------

const RECONNECT_INTERVAL_MS = 3_000;
const RECONNECT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// PeerManager
// ---------------------------------------------------------------------------

type MessageCallback = (message: NetworkMessage, fromPeerId: string) => void;
type PeerCallback = (peerId: string) => void;

export class PeerManager {
  // -- Public read-only state ------------------------------------------------
  public isHost = false;
  public peerId = '';

  // -- Private internals -----------------------------------------------------
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null; // only used by clients
  private connections: Map<string, DataConnection> = new Map(); // host keeps all
  private messageCallbacks: MessageCallback[] = [];
  private connectCallbacks: PeerCallback[] = [];
  private disconnectCallbacks: PeerCallback[] = [];
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private destroyed = false;
  private stateProvider: (() => GameState | null) | null = null;

  // ---- Accessors -----------------------------------------------------------

  get connectedPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Register a function the host can call to obtain the current GameState so
   * that it can be sent to newly-connected (or reconnected) peers.
   */
  setStateProvider(provider: () => GameState | null): void {
    this.stateProvider = provider;
  }

  /**
   * Host a new room. Resolves with the human-friendly room code that other
   * players can use to join.
   */
  hostRoom(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const roomCode = generateRoomCode();

      this.peer = new Peer(roomCode);
      this.isHost = true;

      this.peer.on('open', (id) => {
        this.peerId = id;
        this.setupHostListeners();
        resolve(id);
      });

      this.peer.on('error', (err) => {
        // If the room code is already taken, PeerJS fires an error with
        // type 'unavailable-id'. We could retry with a new code, but for
        // simplicity we surface it.
        reject(err);
      });
    });
  }

  /**
   * Join an existing room as a client.
   */
  joinRoom(roomCode: string, playerName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Create our own Peer with a random id (let PeerJS assign one).
      this.peer = new Peer();
      this.isHost = false;

      this.peer.on('open', (id) => {
        this.peerId = id;

        const conn = this.peer!.connect(roomCode, {
          reliable: true,
          metadata: { playerName },
        });

        conn.on('open', () => {
          this.hostConnection = conn;
          this.setupClientConnection(conn);
          resolve();
        });

        conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Broadcast a message from the host to every connected peer.
   */
  broadcast(message: NetworkMessage): void {
    if (!this.isHost) {
      console.warn('[PeerManager] broadcast() called on a non-host peer');
      return;
    }

    const data = JSON.stringify(message);
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(data);
      }
    }
  }

  /**
   * Client sends a message to the host.
   */
  sendToHost(message: NetworkMessage): void {
    if (this.isHost) {
      console.warn('[PeerManager] sendToHost() called on the host peer');
      return;
    }

    if (this.hostConnection?.open) {
      this.hostConnection.send(JSON.stringify(message));
    } else {
      console.warn('[PeerManager] No open connection to host');
    }
  }

  /**
   * Send a message to a specific peer (host only, by peer id).
   */
  sendTo(targetPeerId: string, message: NetworkMessage): void {
    const conn = this.connections.get(targetPeerId);
    if (conn?.open) {
      conn.send(JSON.stringify(message));
    } else {
      console.warn(`[PeerManager] No open connection to peer ${targetPeerId}`);
    }
  }

  // ---- Callback registration -----------------------------------------------

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  onPlayerConnected(callback: PeerCallback): void {
    this.connectCallbacks.push(callback);
  }

  onPlayerDisconnected(callback: PeerCallback): void {
    this.disconnectCallbacks.push(callback);
  }

  // ---- Teardown ------------------------------------------------------------

  disconnect(): void {
    this.destroyed = true;

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Close every DataConnection
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.messageCallbacks = [];
    this.connectCallbacks = [];
    this.disconnectCallbacks = [];
  }

  // ---- Host-side setup -----------------------------------------------------

  private setupHostListeners(): void {
    if (!this.peer) return;

    this.peer.on('connection', (conn: DataConnection) => {
      this.handleNewConnection(conn);
    });

    this.peer.on('disconnected', () => {
      // The host lost connection to the signalling server. Try to reconnect.
      if (!this.destroyed) {
        this.peer?.reconnect();
      }
    });
  }

  private handleNewConnection(conn: DataConnection): void {
    conn.on('open', () => {
      const remotePeerId = conn.peer;

      // Guard against duplicate connections from the same peer.
      const existing = this.connections.get(remotePeerId);
      if (existing) {
        existing.close();
      }

      // Cancel any pending reconnect timer for this peer.
      this.cancelReconnectTimer(remotePeerId);

      this.connections.set(remotePeerId, conn);
      this.setupDataHandlers(conn, remotePeerId);

      // Notify listeners
      for (const cb of this.connectCallbacks) {
        try { cb(remotePeerId); } catch (e) { console.error(e); }
      }

      // Send full state sync to the newly connected peer.
      this.sendStateSync(remotePeerId);
    });

    conn.on('error', (err) => {
      console.error(`[PeerManager] Connection error with ${conn.peer}:`, err);
    });
  }

  private sendStateSync(targetPeerId: string): void {
    if (!this.stateProvider) return;

    const state = this.stateProvider();
    if (!state) return;

    const msg: NetworkMessage = { type: 'state_sync', state };
    this.sendTo(targetPeerId, msg);
  }

  // ---- Client-side setup ---------------------------------------------------

  private setupClientConnection(conn: DataConnection): void {
    const hostPeerId = conn.peer;

    this.setupDataHandlers(conn, hostPeerId);

    conn.on('close', () => {
      if (!this.destroyed) {
        for (const cb of this.disconnectCallbacks) {
          try { cb(hostPeerId); } catch (e) { console.error(e); }
        }
        this.attemptReconnectToHost(hostPeerId);
      }
    });
  }

  // ---- Shared data handling ------------------------------------------------

  private setupDataHandlers(conn: DataConnection, remotePeerId: string): void {
    conn.on('data', (raw: unknown) => {
      try {
        const message: NetworkMessage =
          typeof raw === 'string' ? JSON.parse(raw) : (raw as NetworkMessage);

        for (const cb of this.messageCallbacks) {
          try { cb(message, remotePeerId); } catch (e) { console.error(e); }
        }
      } catch (err) {
        console.error('[PeerManager] Failed to parse message:', err);
      }
    });

    // Host-side close handling (for individual connections)
    if (this.isHost) {
      conn.on('close', () => {
        if (this.destroyed) return;

        this.connections.delete(remotePeerId);

        for (const cb of this.disconnectCallbacks) {
          try { cb(remotePeerId); } catch (e) { console.error(e); }
        }

        // Start reconnect window for this peer
        this.startReconnectTimer(remotePeerId);
      });
    }
  }

  // ---- Reconnection (host side) --------------------------------------------

  /**
   * After a peer disconnects from the host, we keep a 30-second window where
   * we still accept a new connection from the same peer id. PeerJS handles the
   * incoming connection automatically via the `connection` event, so the timer
   * here just tracks when we should stop expecting a reconnect.
   */
  private startReconnectTimer(remotePeerId: string): void {
    // Clear any existing timer first.
    this.cancelReconnectTimer(remotePeerId);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(remotePeerId);
      // The peer did not reconnect within the window -- nothing further to do.
      // The disconnect callback was already fired when the connection closed.
    }, RECONNECT_TIMEOUT_MS);

    this.reconnectTimers.set(remotePeerId, timer);
  }

  private cancelReconnectTimer(peerId: string): void {
    const timer = this.reconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerId);
    }
  }

  // ---- Reconnection (client side) ------------------------------------------

  private attemptReconnectToHost(hostPeerId: string): void {
    if (this.destroyed || !this.peer) return;

    const startTime = Date.now();

    const tryConnect = () => {
      if (this.destroyed || !this.peer) return;
      if (Date.now() - startTime > RECONNECT_TIMEOUT_MS) {
        console.warn('[PeerManager] Reconnection to host timed out');
        return;
      }

      const conn = this.peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        this.hostConnection = conn;
        this.setupClientConnection(conn);

        for (const cb of this.connectCallbacks) {
          try { cb(hostPeerId); } catch (e) { console.error(e); }
        }
      });

      conn.on('error', () => {
        // Retry after a delay
        if (!this.destroyed) {
          setTimeout(tryConnect, RECONNECT_INTERVAL_MS);
        }
      });

      // If the connection doesn't open within one interval, try again.
      setTimeout(() => {
        if (!conn.open && !this.destroyed) {
          conn.close();
          tryConnect();
        }
      }, RECONNECT_INTERVAL_MS);
    };

    // First attempt after a short delay to let the signalling server settle.
    setTimeout(tryConnect, RECONNECT_INTERVAL_MS);
  }
}

export default PeerManager;
