import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';
import Phaser from 'phaser';
import { MeetingScene } from '../game/MeetingScene';
import { getLobbyState, getGameState, getSuspects, castVote, connectSocket, disconnectSocket, startVoting, endVoting } from '../api/gameApi';
import { useVoiceChat } from '../hooks/useVoiceChat';
import LeftSidebar from '../components/LeftSidebar';
import styles from './MeetingRoomPage.module.css';

const MEETING_DURATION = 600; // 10 minutes in seconds

const MeetingRoomPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const phaserGameRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [murdererName, setMurdererName] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [myVote, setMyVote] = useState(null);
  const [voteResults, setVoteResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(MEETING_DURATION);
  const [gameResult, setGameResult] = useState(null); // 'players_win' | 'murderer_wins'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [speakers, setSpeakers] = useState({});
  const [userSocketMap, setUserSocketMap] = useState({});

  // Voice Chat Hook Integration
  const { isMuted, voiceConnected, toggleMute, peerMicStates } = useVoiceChat(
    roomCode,
    players || [],
    (updatedSpeakers) => setSpeakers(updatedSpeakers)
  );

  // ─── Load initial data ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [lobby, gameState, suspectList] = await Promise.all([
          getLobbyState(roomCode),
          getGameState(roomCode),
          getSuspects(roomCode),
        ]);

        const currentUsername = localStorage.getItem('username');

        // Map players from lobby
        const mappedPlayers = (lobby.players || []).map((p, i) => ({
          id: p._id || p.id || `p${i}`,
          name: p.username || p.name || `Player ${i + 1}`,
          initials: (p.username || p.name || 'P').substring(0, 2).toUpperCase(),
          isMe: (p.username || p.name) === currentUsername,
          isHost: p.isHost || false,
          status: p.status || 'READY',
          micStatus: p.micStatus || 'on',
        }));

        setPlayers(mappedPlayers);
        setSuspects(suspectList);

        // Get murderer name from game state
        if (gameState?.story?.crime?.killer) {
          setMurdererName(gameState.story.crime.killer);
        }

        // Host transitions phase to 'voting' on backend
        const me = mappedPlayers.find(p => p.isMe);
        if (me && me.isHost) {
          try {
            await startVoting(roomCode);
            console.log('[MeetingRoomPage] Transitioned phase to voting on backend.');
          } catch (vErr) {
            console.warn('[MeetingRoomPage] startVoting failed:', vErr.message);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('MeetingRoomPage init error:', err);
        setLoading(false);
      }
    };
    init();
  }, [roomCode]);

  // ─── Socket connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket(roomCode, (event, payload) => {
      if (event === 'joined-room') {
        if (payload.activeSockets) {
          const initialMap = {};
          payload.activeSockets.forEach(s => {
            if (s.username) initialMap[s.username] = s.socketId;
          });
          setUserSocketMap(initialMap);
        }
      }

      else if (event === 'user-joined') {
        if (payload.username && payload.socketId) {
          setUserSocketMap(prev => ({
            ...prev,
            [payload.username]: payload.socketId
          }));
        }
      }

      else if (event === 'user-left') {
        if (payload.username) {
          setUserSocketMap(prev => {
            const next = { ...prev };
            delete next[payload.username];
            return next;
          });
        }
      }

      else if (event === 'room-message') {
        const newMsg = {
          id: `msg-${Date.now()}`,
          sender: payload.sender?.username || payload.senderUsername || 'Unknown',
          content: payload.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages(prev => [...prev, newMsg]);

        // Trigger speaking animation on the Phaser scene
        if (sceneRef.current && newMsg.sender) {
          sceneRef.current.showSpeaking(newMsg.sender);
        }
      }

      if (event === 'vote-cast') {
        const { accusedName, voteCounts } = payload;
        setVoteResults(voteCounts || {});
        if (sceneRef.current && voteCounts) {
          Object.entries(voteCounts).forEach(([name, count]) => {
            sceneRef.current.updateVoteCount(name, count);
          });
        }
      }
    });
    return () => disconnectSocket();
  }, [roomCode]);

  // ─── Phaser Game Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !gameRef.current || phaserGameRef.current) return;

    const handleVote = (playerName, playerId) => {
      if (hasVoted) return;
      handleCastVote(playerId, playerName);
    };

    const handleTimerEnd = () => {
      determineWinner(voteResults);
    };

    const config = {
      type: Phaser.AUTO,
      width: gameRef.current.clientWidth || 900,
      height: gameRef.current.clientHeight || 520,
      backgroundColor: '#0d0508',
      parent: gameRef.current,
      scene: [MeetingScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      callbacks: {
        postBoot: (game) => {
          const scene = game.scene.getScene('MeetingScene');
          sceneRef.current = scene;
        },
      },
    };

    const game = new Phaser.Game(config);
    phaserGameRef.current = game;

    // Start the scene with player data
    game.events.on('ready', () => {
      game.scene.start('MeetingScene', {
        players,
        murdererName,
        duration: MEETING_DURATION,
        onVote: handleVote,
        onTimerEnd: handleTimerEnd,
      });
      sceneRef.current = game.scene.getScene('MeetingScene');
    });

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [loading, players, murdererName]);

  // ─── Voting Logic ─────────────────────────────────────────────────────────────
  const handleCastVote = useCallback(async (suspectId, suspectName) => {
    if (hasVoted) return;
    try {
      await castVote(roomCode, suspectId);
      setHasVoted(true);
      setMyVote(suspectName);
    } catch (err) {
      console.error('Vote error:', err);
    }
  }, [hasVoted, roomCode]);

  const determineWinner = useCallback((votes) => {
    if (!murdererName || gameResult) return;

    // Find suspect with most votes
    let maxVotes = 0;
    let topSuspect = null;
    Object.entries(votes).forEach(([name, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        topSuspect = name;
      }
    });

    const playerWin = topSuspect && topSuspect.toLowerCase().includes(murdererName.toLowerCase());
    const result = playerWin ? 'players_win' : 'murderer_wins';
    setGameResult(result);

    // Call endVoting on backend if host to resolve state
    const me = players.find(p => p.isMe);
    if (me && me.isHost) {
      endVoting(roomCode).catch(e => console.warn('[MeetingRoomPage] endVoting failed:', e.message));
    }

    // Show result in Phaser scene
    if (sceneRef.current) {
      sceneRef.current.showResult(playerWin, murdererName);
    }

    // Navigate to reveal page after 4 seconds
    setTimeout(() => {
      navigate(`/game/${roomCode}/reveal`);
    }, 4500);
  }, [murdererName, gameResult, roomCode, navigate, players]);

  // ─── Chat ─────────────────────────────────────────────────────────────────────
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const currentUsername = localStorage.getItem('username');
    setChatMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      sender: currentUsername || 'You',
      content: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    if (sceneRef.current) {
      sceneRef.current.showSpeaking(currentUsername || '');
    }
    setChatInput('');
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p className="font-mono text-muted">INITIALISING MEETING ROOM...</p>
      </div>
    );
  }

  return (
    <div className={styles.meetingLayout}>
      {/* LEFT — Chat Panel */}
      <aside className={styles.chatSidebar}>
        <div className={styles.chatHeader}>
          <span className="font-mono text-xs text-muted">CASE #{roomCode}</span>
          <span className={`font-mono text-xs ${styles.liveBadge}`}>● LIVE DISCUSSION</span>
        </div>

        {/* Player List (compact) */}
        <div className={styles.playerStrip}>
          {players.map((p, i) => {
            const isSpeaking = speakers[p.name] === true;
            let micStatus = 'on';
            if (p.isMe) {
              micStatus = isMuted ? 'muted' : 'on';
            } else {
              const socketId = userSocketMap[p.name];
              if (socketId) {
                micStatus = peerMicStates[socketId] === true ? 'muted' : 'on';
              }
            }

            return (
              <div key={p.id} className={`${styles.playerChip} ${p.isMe ? styles.meChip : ''} ${isSpeaking ? styles.speakingChip : ''}`}>
                <span className={styles.playerInitials} style={{ background: `hsl(${i * 60}, 70%, 35%)` }}>{p.initials}</span>
                <span className={styles.playerChipName}>{p.isMe ? `${p.name} (YOU)` : p.name}</span>
                <div className={styles.micIconWrapper}>
                  {micStatus === 'on' ? (
                    <Mic size={12} className={styles.micOn} />
                  ) : (
                    <MicOff size={12} className={styles.micOff} />
                  )}
                </div>
                {hasVoted && myVote === p.name && <span className={styles.votedTag}>VOTED</span>}
              </div>
            );
          })}
        </div>

        {/* Messages */}
        <div className={styles.chatMessages}>
          {chatMessages.length === 0 && (
            <p className={styles.chatEmpty}>The meeting has begun. Discuss the evidence and vote for the murderer.</p>
          )}
          {chatMessages.map(msg => (
            <div key={msg.id} className={styles.chatMsg}>
              <span className={styles.chatSender}>{msg.sender}</span>
              <span className={styles.chatTime}>{msg.time}</span>
              <p className={styles.chatContent}>{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Voice control status strip */}
        <div className={styles.voiceControlBar}>
          <span className="font-mono text-xs text-muted">
            VOICE: <span className={voiceConnected ? 'text-accent' : 'text-danger'}>{voiceConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
          <button 
            type="button"
            className={`${styles.smallCommsBtn} ${isMuted ? styles.commsMuted : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? 'CONNECT MIC' : 'MUTE MIC'}
          </button>
        </div>

        {/* Chat Input */}
        <form className={styles.chatForm} onSubmit={handleSendChat}>
          <input
            className={styles.chatInput}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Discuss evidence..."
            maxLength={200}
          />
          <button type="submit" className={styles.chatSendBtn}>SEND</button>
        </form>
      </aside>

      {/* CENTER — Phaser 2D Game Canvas */}
      <main className={styles.gameArea}>
        {/* Timer HUD overlay */}
        <div className={`${styles.timerHud} ${timeLeft <= 60 ? styles.timerDanger : ''}`}>
          <span>⏱ MEETING</span>
          <span className={styles.timerValue}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Phaser canvas mount point */}
        <div ref={gameRef} className={styles.phaserCanvas} />

        {/* Vote hint */}
        {!hasVoted && !gameResult && (
          <div className={styles.voteHint}>
            <span>👆 Click a character to cast your vote</span>
          </div>
        )}

        {/* Voted indicator */}
        {hasVoted && !gameResult && (
          <div className={styles.votedIndicator}>
            <span className="font-mono">✓ VOTE CAST: {myVote?.toUpperCase()}</span>
          </div>
        )}

        {/* Game Result Overlay (React layer backup) */}
        {gameResult && (
          <div className={`${styles.resultOverlay} ${gameResult === 'players_win' ? styles.win : styles.lose}`}>
            <div className={styles.resultBox}>
              <div className={styles.resultIcon}>{gameResult === 'players_win' ? '🎉' : '💀'}</div>
              <h1 className={styles.resultTitle}>
                {gameResult === 'players_win' ? 'CASE SOLVED!' : 'MURDERER WINS'}
              </h1>
              <p className={styles.resultDetail}>
                {gameResult === 'players_win'
                  ? `${murdererName} has been exposed as the murderer.`
                  : `${murdererName} escapes. The case goes cold.`}
              </p>
              <div className={styles.redirecting}>Redirecting to reveal screen...</div>
            </div>
          </div>
        )}
      </main>

      {/* RIGHT — Suspect Vote Panel */}
      <aside className={styles.votePanel}>
        <h2 className={`font-mono ${styles.votePanelTitle}`}>CAST ACCUSATION</h2>
        <p className={styles.votePanelSub}>Vote for the player you believe is the murderer.</p>

        {hasVoted ? (
          <div className={styles.voteConfirmed}>
            <div className={styles.voteCheckmark}>✓</div>
            <p className="font-mono">Vote cast for</p>
            <p className={styles.voteTarget}>{myVote?.toUpperCase()}</p>
            <p className="text-muted font-mono text-xs mt-2">Awaiting other players...</p>
          </div>
        ) : (
          <div className={styles.suspectList}>
            {suspects.map((s, i) => (
              <button
                key={s.id}
                className={styles.suspectBtn}
                onClick={() => handleCastVote(s.id, s.name)}
                disabled={hasVoted}
              >
                <div className={styles.suspectInitials} style={{ background: `hsl(${i * 60}, 60%, 30%)` }}>
                  {s.name.substring(0, 2).toUpperCase()}
                </div>
                <div className={styles.suspectInfo}>
                  <span className={styles.suspectName}>{s.name}</span>
                  <span className={styles.suspectRole}>{s.role}</span>
                </div>
                <div className={styles.suspectVoteCount}>
                  {voteResults[s.name] || 0} <span>votes</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={styles.voteTally}>
          <span className="font-mono text-xs text-muted">VOTES CAST: </span>
          <span className="font-mono text-xs text-accent">
            {Object.values(voteResults).reduce((a, b) => a + b, 0)} / {players.length}
          </span>
        </div>

        <button
          className={styles.backBtn}
          onClick={() => navigate(`/game/${roomCode}`)}
        >
          ← RETURN TO INVESTIGATION
        </button>
      </aside>
    </div>
  );
};

export default MeetingRoomPage;
