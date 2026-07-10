import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomActionBar from '../components/BottomActionBar';
import SuspectVoteCard from '../components/SuspectVoteCard';
import { getSuspects, castVote } from '../api/gameApi';
import { AlertTriangle } from 'lucide-react';
import styles from './VotePage.module.css';

const VotePage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [suspects, setSuspects] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    const fetchSuspects = async () => {
      const data = await getSuspects(roomCode);
      setSuspects(data);
    };
    fetchSuspects();
  }, [roomCode]);

  const handleVote = async (suspectId) => {
    if (hasVoted) return;
    await castVote(roomCode, suspectId);
    setHasVoted(true);
    
    // Refresh suspects to show updated suspicion
    const updated = await getSuspects(roomCode);
    setSuspects(updated);
  };

  return (
    <div className={styles.pageLayout}>
      <LeftSidebar roomCode={roomCode} />

      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <header className={styles.header}>
            <div className={styles.alertBadge}>
              <AlertTriangle size={24} className="text-danger" />
              <span className="font-mono text-danger tracking-widest">ACCUSATION PROTOCOL INITIATED</span>
            </div>
            <h1 className="font-serif text-3xl mt-4 mb-2">Who is the Mind behind the murder?</h1>
            <p className="text-muted">Review the evidence and cast your vote. The majority decides the fate of the accused.</p>
          </header>

          <div className={styles.suspectsGrid}>
            {suspects.map(suspect => (
              <SuspectVoteCard 
                key={suspect.id} 
                suspect={suspect} 
                onVote={handleVote} 
              />
            ))}
          </div>

          {hasVoted && (
            <div className={styles.votingOverlay}>
              <div className="font-mono text-xl text-accent blink mb-4">VOTE REGISTERED.</div>
              <button className={styles.proceedBtn} onClick={() => navigate(`/game/${roomCode}/reveal`)}>
                PROCEED TO REVEAL
              </button>
            </div>
          )}
        </div>

        <BottomActionBar roomCode={roomCode} />
      </main>
    </div>
  );
};

export default VotePage;
