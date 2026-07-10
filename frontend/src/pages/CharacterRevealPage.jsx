import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMyCharacter } from '../api/gameApi';
import { Briefcase, Target, AlertTriangle, Fingerprint } from 'lucide-react';
import styles from './CharacterRevealPage.module.css';

const CharacterRevealPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);

  useEffect(() => {
    const fetchChar = async () => {
      const data = await getMyCharacter(roomCode);
      setCharacter(data);
    };
    fetchChar();
  }, [roomCode]);

  if (!character) {
    return <div className={styles.loading}>Synchronizing Biometrics...</div>;
  }

  const savedPlayerName = localStorage.getItem('playerName');
  const displayName = savedPlayerName || character.name;

  return (
    <div className={styles.pageLayout}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={`${styles.identifiedTag} font-mono`}>IDENTIFIED</div>
          <h1 className={`${styles.name} font-serif`}>{displayName}</h1>
          <h2 className={`${styles.title} font-serif`}>"{character.title}"</h2>
        </header>

        <main className={styles.mainGrid}>
          {/* Left Stack */}
          <div className={styles.leftStack}>
            <div className={`hud-card ${styles.infoCard}`}>
              <div className={styles.cardHeader}>
                <Briefcase size={20} className="text-accent" />
                <h3 className="font-mono">OCCUPATION</h3>
              </div>
              <p className="text-primary">{character.occupation}</p>
            </div>

            <div className={`hud-card ${styles.infoCard} ${styles.objectiveCard}`}>
              <div className={styles.cardHeader}>
                <Target size={20} className="text-accent" />
                <h3 className="font-mono">CURRENT OBJECTIVE</h3>
              </div>
              <p className="font-serif text-lg">{character.objective}</p>
            </div>

            <div className={`hud-card ${styles.infoCard} ${styles.classifiedCard}`}>
              <div className={styles.cardHeader}>
                <AlertTriangle size={20} className="text-danger" />
                <h3 className="font-mono text-danger">CLASSIFIED MISSION</h3>
              </div>
              <p className="font-serif text-lg text-danger">{character.classifiedMission}</p>
            </div>
          </div>

          {/* Right Panel */}
          <div className={styles.rightPanel}>
            <div className={`hud-card ${styles.portraitCard}`}>
              <Fingerprint className={styles.fingerprint} size={48} />
              <div className={styles.portraitImage}></div>
              
              <div className={styles.syncContainer}>
                <div className={styles.syncHeader}>
                  <span className="font-mono text-xs text-muted">BIOMETRIC SYNC</span>
                  <span className="font-mono text-xs text-accent">{character.syncRate}%</span>
                </div>
                <div className={styles.syncBar}>
                  <div className={styles.syncFill} style={{ width: `${character.syncRate}%` }}></div>
                </div>
                <div className="font-mono text-xs text-muted text-center mt-2">{character.serialNumber}</div>
              </div>
            </div>

            <div className={styles.actionArea}>
              <button 
                className={styles.acceptBtn}
                onClick={() => navigate(`/game/${roomCode}`)}
              >
                ACCEPT IDENTITY
              </button>
              <button className={styles.reviewBtn}>Review Briefing</button>
            </div>
          </div>
        </main>
        
        <footer className={styles.footer}>
          <span className="font-mono text-muted">FOR YOUR EYES ONLY // PROJECT [THE GILDED CAGE]</span>
        </footer>
      </div>
    </div>
  );
};

export default CharacterRevealPage;
