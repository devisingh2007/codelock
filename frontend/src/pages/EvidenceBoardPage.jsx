import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import { getClueBoard, toggleClueStatus } from '../api/gameApi';
import { Filter, Search, ArrowLeft } from 'lucide-react';
import styles from './EvidenceBoardPage.module.css';

const EvidenceBoardPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [clues, setClues] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchClues = async () => {
      const data = await getClueBoard(roomCode);
      setClues(data);
    };
    fetchClues();
  }, [roomCode]);

  const handleClueClick = async (clueId) => {
    await toggleClueStatus(clueId);
    const data = await getClueBoard(roomCode);
    setClues(data);
  };

  const filters = ['All', 'Physical Evidence', 'Witness Statements', 'Time-Related'];
  const filteredClues = filter === 'All' ? clues : clues.filter(c => c.type === filter);

  const getStatusColor = (status) => {
    switch(status) {
      case 'New': return 'var(--accent-color)';
      case 'Discussed': return 'var(--text-secondary)';
      case 'Ignored': return 'var(--text-muted)';
      case 'Verified': return 'var(--success-color)';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <div className={styles.pageLayout}>
      <TopNavBar />
      
      <main className={styles.boardContainer}>
        
        <div className={styles.boardHeader}>
          <div className="flex items-center gap-4">
            <button className={styles.backBtn} onClick={() => navigate(`/game/${roomCode}`)}>
              <ArrowLeft size={18} /> BACK
            </button>
            <h1 className="font-serif text-2xl">Evidence Board</h1>
          </div>
          
          <div className={styles.filters}>
            <Filter size={16} className="text-muted" />
            {filters.map(f => (
              <button 
                key={f} 
                className={`${styles.filterChip} ${filter === f ? styles.activeFilter : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.corkboard}>
          {/* Simulated Red Strings using an SVG overlay */}
          <svg className={styles.stringLayer}>
            {/* Hardcoded string lines for visual effect in this demo */}
            <line x1="20%" y1="30%" x2="50%" y2="60%" stroke="rgba(192, 57, 43, 0.6)" strokeWidth="2" strokeDasharray="5,5" />
            <line x1="50%" y1="60%" x2="70%" y2="40%" stroke="rgba(192, 57, 43, 0.6)" strokeWidth="2" />
          </svg>

          {filteredClues.map((clue, idx) => (
            <div 
              key={clue.id} 
              className={styles.clueCard}
              style={{
                top: `${20 + (idx * 15)}%`,
                left: `${10 + (idx * 25)}%`,
                transform: `rotate(${Math.random() * 10 - 5}deg)`,
                cursor: 'pointer'
              }}
              onClick={() => handleClueClick(clue.id)}
            >
              <div className={styles.pushpin}></div>
              
              <div className={styles.cardHeader}>
                <span className={styles.importanceBadge}>{clue.importanceTier}</span>
                <span 
                  className={styles.statusTag} 
                  style={{ color: getStatusColor(clue.status), borderColor: getStatusColor(clue.status) }}
                >
                  {clue.status}
                </span>
              </div>
              
              <h3 className="font-serif text-xl mt-2 mb-2">{clue.name}</h3>
              <p className="text-sm text-secondary">{clue.desc}</p>
              
              <div className={styles.cardFooter}>
                <span className="font-mono text-xs text-muted">{clue.type}</span>
              </div>
            </div>
          ))}
        </div>
        
      </main>
    </div>
  );
};

export default EvidenceBoardPage;
