import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { autoAuthenticate, createRoom } from '../api/gameApi';
import lampImg from '../assets/game/studylamp.png';
import styles from './CreateRoomPage.module.css';

const CreateRoomPage = () => {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState('Medium');
  const [partySize, setPartySize] = useState(6);
  const [theme, setTheme] = useState('mansion');
  const [alias, setAlias] = useState('');
  const [caseName, setCaseName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await autoAuthenticate(alias);
      const room = await createRoom();
      navigate(`/lobby/${room.roomCode}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageLayout}>
      <main className={styles.mainContent}>
        <div className={styles.formContainer}>
          <div className={styles.formWrapper}>
            <button className={styles.backBtn} onClick={() => navigate('/')} type="button">
              <ArrowLeft size={16} /> Back to Dossier
            </button>

            <div className={styles.header}>
              <h1 className="font-serif">Initiate Investigation</h1>
              <p className="text-muted">The mystery awaits your orchestration. Configure the crime scene below.</p>
              {error && <div style={{ color: '#b91c1c', fontFamily: 'monospace', marginTop: '10px' }}>{error}</div>}
            </div>

            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">HOST NAME</label>
                  <input 
                    type="text" 
                    placeholder="Enter your alias..." 
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    required 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className="font-mono">CASE FILE NAME</label>
                  <input 
                    type="text" 
                    placeholder="Case #404..." 
                    value={caseName}
                    onChange={(e) => setCaseName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">INVESTIGATION SETTING</label>
                  <select 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    required
                  >
                    <option value="mansion">Classic Mansion</option>
                    <option value="cruise">Luxury Cruise</option>
                    <option value="space">Space Station</option>
                    <option value="palace">Ancient Palace</option>
                    <option value="cyber">Cyber Crime</option>
                    <option value="hotel">Hotel Murder</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
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
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">TASK FORCE SIZE</label>
                  <div className={styles.stepper}>
                    <span className={styles.stepperLabel}>Max Players</span>
                    <div className={styles.stepperControls}>
                      <button type="button" onClick={() => setPartySize(Math.max(2, partySize - 1))}>-</button>
                      <span className="font-mono">{partySize}</span>
                      <button type="button" onClick={() => setPartySize(Math.min(8, partySize + 1))}>+</button>
                    </div>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label className="font-mono">COMMS CHANNEL</label>
                  <div className={styles.toggleGroup}>
                    <span className={styles.toggleLabel}>Voice Chat</span>
                    <label className={styles.switch}>
                      <input type="checkbox" defaultChecked />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'CREATING...' : 'Create Game'}
              </button>
            </form>
          </div>
        </div>

        <div className={styles.imagePanel} style={{ backgroundImage: `url(${lampImg})` }}>
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
