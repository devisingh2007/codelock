import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLobbyState, connectSocket, disconnectSocket, sendMessage, generateMysteryForRoomCode, kickPlayer, addPlayer } from '../api/gameApi';
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

  useEffect(() => {
    // 1. Fetch initial state
    const fetchState = async () => {
      try {
        const state = await getLobbyState(roomCode);
        setRoomState(state);
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
      
      else if (event === 'user-kicked') {
        fetchState();
        setRoomState(currState => {
          if (currState) {
            const me = currState.players.find(p => p.isMe);
            if (me && me.id === payload.userId) {
              alert("You have been kicked from the lobby by the host.");
              navigate('/');
            }
          }
          return currState;
        });
        setChatMessages(prev => [
          ...prev,
          { id: `kick-${Date.now()}`, sender: 'System', message: `${payload.username} has been kicked from the lobby.` }
        ]);
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
      // Host triggers the mystery generation
      await generateMysteryForRoomCode(roomCode);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to generate mystery. Check if Ollama is running.');
      setStarting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const handleKickPlayer = (playerId, playerName) => {
    kickPlayer(roomCode, playerId, (res) => {
      if (res.error) {
        alert(res.error);
      }
    });
  };

  const handleAddPlayer = () => {
    const name = prompt("Enter detective name/alias to add to the lobby:");
    if (name && name.trim()) {
      addPlayer(roomCode, name.trim(), (res) => {
        if (res.error) {
          alert(res.error);
        }
      });
    }
  };

  if (!roomState) {
    return <div className={styles.loading}>Connecting to the Estate...</div>;
  }

  const { caseInfo, players } = roomState;
  const me = players.find(p => p.isMe);
  const isHost = me ? me.isHost : false;

  return (
    <div className={styles.container}>
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
                <button className={styles.copyBtn} onClick={handleCopyCode}><Copy size={16} /></button>
              </div>
            </div>
          </div>

          <div className={styles.playersGrid}>
            {players.map(p => (
              <PlayerCard 
                key={p.id} 
                player={p} 
                showKickBtn={isHost && !p.isHost}
                onKick={handleKickPlayer}
              />
            ))}
            {isHost ? (
              <button className={styles.addPlayerCard} onClick={handleAddPlayer}>
                <Plus size={24} className="mb-2" />
                <span>ADD DETECTIVE</span>
              </button>
            ) : (
              <button className={styles.inviteCard} onClick={handleCopyCode}>
                <Plus size={24} className="mb-2" />
                <span>COPY ROOM CODE</span>
              </button>
            )}
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
              <label className="font-mono text-muted">DIFFICULTY</label>
              <div className={styles.pills}>
                <div className={`${styles.pill} ${caseInfo.difficulty === 'Easy' || caseInfo.difficulty === 'Novice' ? styles.pillActive : ''}`}>Easy</div>
                <div className={`${styles.pill} ${caseInfo.difficulty === 'Medium' ? styles.pillActive : ''}`}>Medium</div>
                <div className={`${styles.pill} ${caseInfo.difficulty === 'Hard' || caseInfo.difficulty === 'Master' ? styles.pillActive : ''}`}>Hard</div>
              </div>
            </div>

            <div className={styles.statsList}>
              <SuspicionMeter level={85} label="SUSPENSE LEVEL" variant="text" />
              <SuspicionMeter level={30} label="AI ACTIVITY" variant="text" />
            </div>
          </div>

          <div className={styles.startContainer}>
            <div className={styles.playerCount}>
              <span className="font-mono">{players.length}/8 PLAYERS READY</span>
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
            <p className={styles.hostNote}>Only the host can initiate the case</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;
