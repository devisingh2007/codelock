import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRevealData } from '../api/gameApi';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import styles from './RevealPage.module.css';

const RevealPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [reveal, setReveal] = useState(null);

  useEffect(() => {
    const fetchReveal = async () => {
      const data = await getRevealData(roomCode);
      setReveal(data);
    };
    fetchReveal();
  }, [roomCode]);

  if (!reveal && reveal !== null) return <div className={styles.loading}>Processing Verdict...</div>;
  if (reveal === null) return (
    <div className={styles.loading}>
      <p style={{color:'var(--danger-color,#e55)', fontFamily:'monospace'}}>
        ⚠ Could not load reveal data. The game may not be complete yet.
      </p>
      <button style={{marginTop:'16px',padding:'10px 24px',cursor:'pointer'}} onClick={() => navigate('/')}>Return to HQ</button>
    </div>
  );

  return (
    <div className={styles.pageLayout}>
      <div className={styles.bgOverlay}></div>

      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={`${styles.verdictTitle} ${reveal.success ? styles.success : styles.failure} font-serif glow-accent`}>
            {reveal.success ? 'CASE SOLVED' : 'INVESTIGATION FAILED'}
          </h1>
          <p className="font-mono text-muted tracking-widest mt-2">{reveal.subtitle}</p>
        </header>

        <main className={styles.mainBox}>
          <div className={`hud-card ${styles.murdererCard}`}>
            <div className={styles.portraitWrapper}>
              {/* Replace with actual image in real app */}
              <div className={styles.portraitPlaceholder}></div>
              {reveal.success && (
                <div className={styles.stamp}>GUILTY</div>
              )}
            </div>
            
            <div className={styles.details}>
              <h2 className="font-serif text-3xl text-accent mb-2">The Murderer was:</h2>
              <h3 className="font-serif text-4xl mb-4">{reveal.murdererName}</h3>
              <p className={styles.narrative}>{reveal.narrative}</p>
            </div>
          </div>

          <div className={styles.statsPanel}>
            <h4 className="font-mono text-muted mb-4 text-center">INVESTIGATION METRICS</h4>
            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className="font-mono text-xs text-muted">VOTES CORRECT</span>
                <span className="font-serif text-2xl text-accent">{reveal.stats.votesCorrect}/{reveal.stats.totalPlayers}</span>
              </div>
              <div className={styles.statBox}>
                <span className="font-mono text-xs text-muted">EVIDENCE FOUND</span>
                <span className="font-serif text-2xl text-accent">{reveal.stats.evidenceFound}/{reveal.stats.totalEvidence}</span>
              </div>
              <div className={styles.statBox}>
                <span className="font-mono text-xs text-muted">TIME ELAPSED</span>
                <span className="font-serif text-2xl text-accent">{reveal.stats.timeTaken}</span>
              </div>
            </div>
          </div>
        </main>

        <footer className={styles.footer}>
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate(`/game/${roomCode}/report`)}>
              VIEW FULL REPORT
            </button>
            <button className={styles.primaryBtn} onClick={() => navigate('/')}>
              RETURN TO HQ
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default RevealPage;
