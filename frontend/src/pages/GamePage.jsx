import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLobbyState, getEvidence, getObjectives, getTimeline, sendMessage, connectSocket, disconnectSocket } from '../api/gameApi';
import LeftSidebar from '../components/LeftSidebar';
import BottomActionBar from '../components/BottomActionBar';
import InvestigationFeed from '../components/InvestigationFeed';
import PlayerCard from '../components/PlayerCard';
import EvidenceCard from '../components/EvidenceCard';
import { Settings, User, Clock, Shield, FileText, Database, Fingerprint, Lock } from 'lucide-react';
import styles from './GamePage.module.css';

const iconMap = {
  document: FileText,
  sample: Database,
  fingerprint: Fingerprint,
  lock: Lock,
};

const GamePage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  
  const [roomState, setRoomState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('evidence');
  const [chatInput, setChatInput] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const state = await getLobbyState(roomCode);
        const evs = await getEvidence(roomCode);
        const objs = await getObjectives(roomCode);
        const time = await getTimeline(roomCode);

        setRoomState(state);
        setEvidence(evs);
        setObjectives(objs);
        setTimeline(time);
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchData();

    // Connect Socket.IO
    connectSocket(roomCode, (event, payload) => {
      console.log(`[GamePage] Event received: ${event}`, payload);
      
      if (event === 'joined-room' && payload.chatHistory) {
        const history = payload.chatHistory.map(h => ({
          id: h._id,
          sender: h.senderUsername,
          type: h.senderUsername === 'Game Master' ? 'gm' : 'player',
          content: h.message,
          time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setMessages(history);
      }
      
      else if (event === 'room-message') {
        setMessages(prev => [
          ...prev,
          {
            id: payload.id || `msg-${Date.now()}`,
            sender: payload.sender.username,
            type: payload.sender.username === 'Game Master' ? 'gm' : 'player',
            content: payload.message,
            time: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
      
      else if (event === 'sync-state' || event === 'state-changed') {
        const state = payload.state;
        if (state && state.story && state.story.victim) {
          if (state.story.timeline) {
            setTimeline(state.story.timeline.map(t => ({
              date: t.time,
              event: t.event
            })));
          }
          if (state.story.crime) {
            setEvidence([
              { id: 'e1', name: state.story.crime.weapon || 'Murder Weapon', status: 'revealed', icon: 'sample' },
              { id: 'e2', name: 'Crime Summary', status: 'revealed', icon: 'document' },
              { id: 'e3', name: 'Victim Dossier', status: 'revealed', icon: 'document' },
              { id: 'e4', name: 'Alibis & Motives', status: 'revealed', icon: 'document' }
            ]);
          }
        }
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [roomCode]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const input = chatInput;
    setChatInput('');
    await sendMessage(roomCode, input);
  };

  const handleEvidenceClick = (ev) => {
    if (ev.status === 'locked') return;
    setSelectedEvidence(ev);
  };

  const handleInspectAI = () => {
    if (!selectedEvidence) return;
    setChatInput(`I want to inspect the ${selectedEvidence.name}`);
    setSelectedEvidence(null);
  };

  if (!roomState) return <div className={styles.loading}>Connecting to HUD...</div>;

  const { caseInfo, players } = roomState;
  const savedPlayerName = localStorage.getItem('playerName');
  const mappedPlayers = players.map(p => {
    if (p.isMe && savedPlayerName) {
      const initials = savedPlayerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      return { ...p, name: savedPlayerName, initials };
    }
    return p;
  });

  return (
    <div className={styles.pageLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className="font-mono text-muted text-xs">CASE #{caseInfo.number} PERSONNEL</div>
        </div>
        <div className={styles.playerList}>
          {mappedPlayers.map(p => <PlayerCard key={p.id} player={p} />)}
        </div>
        <div className={styles.sidebarFooter}>
          <button className={styles.commsBtn}>COMMS SETTINGS</button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <div className={styles.locationInfo}>
            <span className="font-mono text-muted">CURRENT LOCATION //</span>
            <span className="font-serif text-xl ml-2">The Grand Ballroom</span>
          </div>
          
          <div className={styles.topStats}>
            <div className={styles.aiStatusPill}>
              <span className={styles.aiDot}></span>
              <span className="font-mono text-xs">AI: OBSERVING</span>
            </div>
            <div className={styles.statBadge}>
              <Clock size={16} className="text-accent" />
              <span className="font-mono">42:15</span>
            </div>
            <div className={styles.statBadge}>
              <Shield size={16} className="text-accent" />
              <span className="font-mono">6/8 SURVIVORS</span>
            </div>
            <button className={styles.iconBtn}><Settings size={20} /></button>
            <button className={styles.iconBtn} onClick={() => navigate('/profile')}><User size={20} /></button>
          </div>
        </header>

        <div className={styles.centerColumns}>
          {/* Center Chat/Feed */}
          <section className={styles.feedColumn}>
            <InvestigationFeed messages={messages} />
            <form className={styles.chatForm} onSubmit={handleSendMessage}>
              <input 
                type="text" 
                className={styles.chatInput} 
                placeholder="Message your team or game master..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className={styles.sendBtn}>SEND</button>
            </form>
          </section>

          {/* Right Panel */}
          <section className={styles.rightPanel}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'evidence' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('evidence')}
              >
                EVIDENCE
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'intel' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('intel')}
              >
                INTEL
              </button>
            </div>

            <div className={styles.panelContent}>
              <div className={styles.objectivesSection}>
                <h3 className="font-mono text-muted mb-2">ACTIVE OBJECTIVES</h3>
                <ul className={styles.objList}>
                  {objectives.map(obj => (
                    <li key={obj.id} className={obj.completed ? styles.objCompleted : ''}>
                      <span className={styles.checkbox}>{obj.completed && '✓'}</span>
                      {obj.text}
                    </li>
                  ))}
                </ul>
              </div>

              {activeTab === 'evidence' && (
                <div className={styles.evidenceSection}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-mono text-muted">EVIDENCE LOG</h3>
                    <button 
                      className={styles.boardBtn}
                      onClick={() => navigate(`/game/${roomCode}/board`)}
                    >
                      OPEN CORKBOARD
                    </button>
                  </div>
                  <div className={styles.evidenceGrid}>
                    {evidence.map(ev => (
                      <EvidenceCard 
                        key={ev.id} 
                        evidence={ev} 
                        onClick={() => handleEvidenceClick(ev)} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'intel' && (
                <div className={styles.timelineSection}>
                  <h3 className="font-mono text-muted mb-2">TIMELINE</h3>
                  <ul className={styles.timelineList}>
                    {timeline.map((t, idx) => (
                      <li key={idx}>
                        <span className="font-mono text-accent">{t.date}</span>
                        <span className="text-sm">{t.event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button 
              className={styles.accuseBtn}
              onClick={() => navigate(`/game/${roomCode}/vote`)}
            >
              ACCUSE NOW
            </button>
          </section>
        </div>

        <BottomActionBar roomCode={roomCode} />
      </main>

      {/* Evidence Modal */}
      {selectedEvidence && (
        <div className={styles.modalOverlay} onClick={() => setSelectedEvidence(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              {React.createElement(iconMap[selectedEvidence.icon] || FileText, { size: 32, className: 'text-accent' })}
              <h2 className="font-serif text-xl">{selectedEvidence.name}</h2>
            </div>
            
            <div className={styles.modalDesc}>
              {selectedEvidence.description || "No further details available. Ask the AI Game Master for more information."}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedEvidence(null)}>CLOSE</button>
              <button className={styles.modalInspectBtn} onClick={handleInspectAI}>INSPECT VIA AI</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
