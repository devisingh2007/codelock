import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import styles from './CreateRoomPage.module.css';

const CreateRoomPage = () => {
  const navigate = useNavigate();
  const [alias, setAlias] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [partySize, setPartySize] = useState(4);
  const [theme, setTheme] = useState('mansion');

  const themes = [
    { id: 'mansion', name: 'Haunted Mansion', desc: 'Hidden passages & dusty portraits' },
    { id: 'cruise', name: 'Luxury Cruise', desc: 'Isolated at sea, high society motives' },
    { id: 'space', name: 'Space Station', desc: 'Airlocks & corrupted data logs' },
    { id: 'palace', name: 'Ancient Palace', desc: 'Poison, politics & ancient grudges' },
    { id: 'cyber', name: 'Cyber Crime', desc: 'Encrypted trails & rogue synthetics' },
    { id: 'hotel', name: 'Hotel Murder', desc: 'Master keys & noisy neighbors' }
  ];

  const difficultyText = {
    Easy: "More clues, less deception",
    Medium: "Balanced investigation",
    Hard: "More decoys, deeper relationships, less obvious motive"
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (alias.trim()) {
      localStorage.setItem('playerName', alias.trim());
    }
    navigate('/lobby/NX-4209');
  };

  return (
    <div className={styles.pageLayout}>
      <LeftSidebar />
      
      <main className={styles.mainContent}>
        <div className={styles.formContainer}>
          <div className={styles.header}>
            <h1 className="font-serif">Create Investigation</h1>
            <p className="text-muted">Configure the crime scene parameters.</p>
          </div>

          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className="font-mono">DETECTIVE ALIAS</label>
                <input 
                  type="text" 
                  placeholder="e.g. Inspector Holmes" 
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  required 
                />
              </div>
              <div className={styles.inputGroup}>
                <label className="font-mono">CASE FILE NAME</label>
                <input type="text" placeholder="Case #404..." required />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroupColSpan2}>
                <label className="font-mono">SCENARIO SETTING</label>
                <div className={styles.themeGrid}>
                  {themes.map(t => (
                    <div 
                      key={t.id} 
                      className={`${styles.themeCard} ${theme === t.id ? styles.themeActive : ''}`}
                      onClick={() => setTheme(t.id)}
                    >
                      <h5>{t.name}</h5>
                      <p>{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroupColSpan2}>
                <label className="font-mono">DIFFICULTY LEVEL</label>
                <div className={styles.pills}>
                  {['Easy', 'Medium', 'Hard'].map(level => (
                    <button
                      key={level}
                      type="button"
                      className={`${styles.pill} ${difficulty === level ? styles.pillActive : ''}`}
                      onClick={() => setDifficulty(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className={styles.difficultyDesc}>{difficultyText[difficulty]}</div>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className="font-mono">PARTY SIZE</label>
                <div className={styles.stepper}>
                  <button type="button" onClick={() => setPartySize(Math.max(2, partySize - 1))}>-</button>
                  <span className="font-mono">{partySize}</span>
                  <button type="button" onClick={() => setPartySize(Math.min(8, partySize + 1))}>+</button>
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label className="font-mono">COMMS CHANNEL</label>
                <div className={styles.toggleGroup}>
                  <span>Voice Chat</span>
                  <label className={styles.switch}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn}>
              CREATE GAME
            </button>
          </form>
        </div>

        <div className={styles.imagePanel}>
          <div className={styles.corkboardOverlay}>
            <div className={`${styles.analyzingBadge} font-mono`}>
              <span className={styles.dot}></span> AI ANALYZING...
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateRoomPage;
