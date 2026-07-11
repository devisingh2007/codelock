import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLobbyState, connectSocket, disconnectSocket, sendMessage, generateMysteryForRoomCode } from '../api/gameApi';
import TopNavBar from '../components/TopNavBar';
import PlayerCard from '../components/PlayerCard';
import SuspicionMeter from '../components/SuspicionMeter';
import { Copy, Plus, Send } from 'lucide-react';
import styles from './LobbyPage.module.css';

const LobbyPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { id: 'sys-1', sender: 'System', message: 'Connecting to the secure comms channel...' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(sessionStorage.getItem('difficulty') || 'medium');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Fetch initial state
    const fetchState = async () => {
      try {
        const state = await getLobbyState(roomCode);
        if (state && state.status === 'in_progress') {
          navigate(`/game/${roomCode}/character`);
          return;
        }
        setRoomState(state);
        if (state && state.caseInfo && state.caseInfo.difficulty) {
          // Sync state difficulty if present
          setSelectedDifficulty(state.caseInfo.difficulty.toLowerCase());
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load lobby state.');
      }
    };
    fetchState();

    // 2. Connect Socket.IO
    const socket = connectSocket(roomCode, (event, payload) => {
      console.log(`[LobbyPage] Received event: ${event}`, payload);

      if (event === 'joined-room') {
        if (payload.chatHistory) {
          const history = payload.chatHistory.map(h => ({
            id: h._id,
            sender: h.senderUsername,
            message: h.message,
            timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setChatMessages([
            { id: 'sys-2', sender: 'System', message: 'Joined secure lobby channel.' },
            ...history
          ]);
        }
      }

      else if (event === 'user-joined') {
        // Refresh players list
        fetchState();
        setChatMessages(prev => [
          ...prev,
          { id: `join-${Date.now()}`, sender: 'System', message: `${payload.username} has entered the room.` }
        ]);
      }

      else if (event === 'user-left') {
        // Refresh players list
        fetchState();
        setChatMessages(prev => [
          ...prev,
          { id: `left-${Date.now()}`, sender: 'System', message: `${payload.username} has disconnected.` }
        ]);
      }

      else if (event === 'room-message') {
        setChatMessages(prev => [
          ...prev,
          {
            id: payload.id || `msg-${Date.now()}`,
            sender: payload.sender.username,
            message: payload.message,
            timestamp: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }

      else if (event === 'mystery-generated') {
        setChatMessages(prev => [
          ...prev,
          { id: `sys-gen-${Date.now()}`, sender: 'System', message: 'AI Mystery successfully generated!' }
        ]);
        // All players automatically navigate to the character sheet reveal page
        setTimeout(() => {
          navigate(`/game/${roomCode}/character`);
        }, 1500);
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [roomCode, navigate]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await sendMessage(roomCode, chatInput);
      setChatInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleStartInvestigation = async () => {
    setStarting(true);
    setError('');
    try {
      const theme = sessionStorage.getItem('theme') || 'mansion';
      
      // Host triggers the mystery generation with case settings
      await generateMysteryForRoomCode(roomCode, {
        difficulty: selectedDifficulty,
        locationHints: `Theme: ${theme}`
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to generate mystery. Check if Ollama is running.');
      setStarting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!roomState) {
    return <div className={styles.loading}>Connecting to the Estate...</div>;
  }

  const { caseInfo, players } = roomState;

  // Resolve the current player's display name from sessionStorage if available
  const savedPlayerName = sessionStorage.getItem('username') || sessionStorage.getItem('playerName');
  const mappedPlayers = players.map(p => {
    if (p.isMe && savedPlayerName) {
      const initials = savedPlayerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      return { ...p, name: savedPlayerName, initials };
    }
    return p;
  });

  const me = mappedPlayers.find(p => p.isMe);
  const isHost = me ? me.isHost : false;

  return (
    <div className={styles.container}>
      <TopNavBar />

      <main className={styles.mainContent}>
        {/* Left/Center Column */}
        <div className={styles.leftCol}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={`${styles.caseTitle} font-serif`}>{caseInfo.name}</h1>
              <p className="text-muted font-mono">Case #{caseInfo.number} • Waiting for investigators...</p>
              {error && <div style={{ color: 'var(--accent-color)', fontFamily: 'monospace', marginTop: '10px' }}>{error}</div>}
            </div>
            <div className={styles.roomCodeBox}>
              <span className="font-mono text-muted">ROOM CODE</span>
              <div className={styles.codeRow}>
                <span className={`${styles.code} font-mono`}>{roomCode}</span>
                <button className={styles.copyBtn} onClick={handleCopyCode}>
                  {copied ? <span style={{ fontSize: '10px' }}>COPIED!</span> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.playersGrid}>
            {mappedPlayers.map(p => <PlayerCard key={p.id} player={p} />)}
            <button className={styles.inviteCard} onClick={handleCopyCode}>
              <Plus size={24} className="mb-2" />
              <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY ROOM CODE'}</span>
            </button>
          </div>

          <div className={`hud-card ${styles.chatPanel}`}>
            <h3 className="font-mono text-muted mb-4">LIVE LOBBY FEED</h3>
            <div className={styles.chatScroll}>
              {chatMessages.map(msg => (
                <div key={msg.id} className={styles.chatMsg}>
                  <span className={msg.sender === 'System' ? 'text-danger' : 'text-accent'}>{msg.sender}:</span> {msg.message}
                </div>
              ))}
            </div>
            <form className={styles.chatInputRow} onSubmit={handleSendChat}>
              <input
                type="text"
                placeholder="Send message..."
                className={styles.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className={styles.sendBtn}><Send size={18} /></button>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightCol}>
          <div className={`hud-card ${styles.paramsCard}`}>
            <h3 className="font-mono text-muted mb-4">CASE PARAMETERS</h3>

            <div className={styles.paramGroup}>
              <label className="font-mono text-muted">SCENARIO</label>
              <div className={styles.paramValue}>{caseInfo.scenario}</div>
            </div>

            <div className={styles.paramGroup}>
              <label className="font-mono text-muted">
                DIFFICULTY {isHost && <span style={{ color: 'var(--accent-color)', fontSize: '10px' }}>(EDITABLE)</span>}
              </label>
              <div className={styles.pills}>
                {['Easy', 'Medium', 'Hard'].map((level) => (
                  <div
                    key={level}
                    className={`${styles.pill} ${selectedDifficulty === level.toLowerCase() ? styles.pillActive : ''}`}
                    style={isHost ? { cursor: 'pointer' } : {}}
                    onClick={() => isHost && setSelectedDifficulty(level.toLowerCase())}
                  >
                    {level}
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className={styles.startContainer}>
            <div className={styles.playerCount}>
              <span className="font-mono">{mappedPlayers.length}/8 PLAYERS READY</span>
            </div>
            {isHost ? (
              <button
                className={styles.startBtn}
                disabled={starting}
                onClick={handleStartInvestigation}
              >
                {starting ? 'GENERATING MYSTERY...' : 'START INVESTIGATION'}
              </button>
            ) : (
              <button
                className={styles.startBtn}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              >
                WAITING FOR HOST
              </button>
            )}
            {!isHost && <p className={styles.hostNote}>Only the host can initiate the case</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;
