import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLobbyState } from '../api/gameApi';
import TopNavBar from '../components/TopNavBar';
import PlayerCard from '../components/PlayerCard';
import SuspicionMeter from '../components/SuspicionMeter';
import { Copy, Plus, Send } from 'lucide-react';
import styles from './LobbyPage.module.css';

const LobbyPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState(null);

  useEffect(() => {
    const fetchState = async () => {
      const state = await getLobbyState(roomCode);
      setRoomState(state);
    };
    fetchState();
  }, [roomCode]);

  if (!roomState) {
    return <div className={styles.loading}>Connecting to the Estate...</div>;
  }

  const { caseInfo, players } = roomState;

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
            </div>
            <div className={styles.roomCodeBox}>
              <span className="font-mono text-muted">ROOM CODE</span>
              <div className={styles.codeRow}>
                <span className={`${styles.code} font-mono`}>{roomCode}</span>
                <button className={styles.copyBtn}><Copy size={16} /></button>
              </div>
            </div>
          </div>

          <div className={styles.playersGrid}>
            {players.map(p => <PlayerCard key={p.id} player={p} />)}
            <button className={styles.inviteCard}>
              <Plus size={24} className="mb-2" />
              <span>INVITE FRIEND</span>
            </button>
          </div>

          <div className={`hud-card ${styles.chatPanel}`}>
            <h3 className="font-mono text-muted mb-4">LIVE LOBBY FEED</h3>
            <div className={styles.chatScroll}>
              <div className={styles.chatMsg}>
                <span className="text-accent">System:</span> Waiting for host to initiate the protocol...
              </div>
              <div className={styles.chatMsg}>
                <span className="text-accent">Arthur:</span> Are we ready to begin?
              </div>
            </div>
            <div className={styles.chatInputRow}>
              <input type="text" placeholder="Send message..." className={styles.chatInput} />
              <button className={styles.sendBtn}><Send size={18} /></button>
            </div>
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
                <div className={`${styles.pill} ${caseInfo.difficulty === 'Novice' ? styles.pillActive : ''}`}>Novice</div>
                <div className={`${styles.pill} ${caseInfo.difficulty === 'Master' ? styles.pillActive : ''}`}>Master</div>
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
            <button 
              className={styles.startBtn} 
              onClick={() => navigate(`/game/${roomCode}/character`)}
            >
              START INVESTIGATION
            </button>
            <p className={styles.hostNote}>Only the host can initiate the case</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;
