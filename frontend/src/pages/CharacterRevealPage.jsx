import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMyCharacter } from '../api/gameApi';
import { Briefcase, Target, AlertTriangle, Fingerprint, Eye, Skull } from 'lucide-react';
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

  const savedPlayerName = sessionStorage.getItem('playerName');
  const displayName = savedPlayerName || character.name;

  return (
    <div className={styles.pageLayout}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={`${styles.identifiedTag} font-mono`}>
            {character.isMurderer ? '⚠ CLASSIFIED ASSET' : 'IDENTIFIED'}
          </div>
          <h1 className={`${styles.name} font-serif`}>{displayName}</h1>
          <h2 className={`${styles.title} font-serif`}>"{character.title}"</h2>
          {character.isMurderer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: 'var(--danger-color, #e55)' }}>
              <Skull size={18} />
              <span className="font-mono text-sm">YOU ARE THE MURDERER — STAY HIDDEN</span>
            </div>
          )}
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
                <h3 className="font-mono text-danger">CLASSIFIED SECRET</h3>
              </div>
              <p className="font-serif text-lg text-danger">{character.classifiedMission}</p>
            </div>

            {character.personalClues && character.personalClues.length > 0 && (
              <div className={`hud-card ${styles.infoCard}`}>
                <div className={styles.cardHeader}>
                  <Eye size={20} className="text-accent" />
                  <h3 className="font-mono">YOUR INTEL CLUES</h3>
                </div>
                <ul style={{ listStyle: 'disc', paddingLeft: '18px', marginTop: '6px' }}>
                  {character.personalClues.map((clue, i) => (
                    <li key={i} className="text-sm" style={{ marginBottom: '6px' }}>{clue}</li>
                  ))}
                </ul>
              </div>
            )}
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
          <span className="font-mono text-muted">
            FOR YOUR EYES ONLY // {character.isMurderer ? 'DO NOT REVEAL YOUR ROLE' : `CASE: ${character.name?.toUpperCase()}`}
          </span>
        </footer>
      </div>
    </div>
  );
};

export default CharacterRevealPage;
