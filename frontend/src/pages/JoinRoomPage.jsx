import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, MapPin, Users } from 'lucide-react';
import styles from './JoinRoomPage.module.css';

const JoinRoomPage = () => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      navigate(`/lobby/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div className={styles.pageLayout}>
      <div className={styles.bgOverlay}></div>

      <div className={styles.content}>
        <div className={`hud-card ${styles.joinCard}`}>
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl text-accent mb-2">Join Investigation</h1>
            <p className="text-muted">Enter the scene of the crime</p>
          </div>

          <form onSubmit={handleJoin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className="font-mono">PLAYER NAME</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Detective Holmes" 
                required 
              />
            </div>
            <div className={styles.inputGroup}>
              <label className="font-mono">ROOM CODE</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="e.g. ALPHA-9" 
                maxLength={8}
                style={{ textTransform: 'uppercase' }}
                required 
              />
            </div>

            <button type="submit" className={styles.submitBtn}>
              JOIN ROOM
            </button>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
              Back to Home
            </button>
          </form>
        </div>

        <div className={styles.recentSection}>
          <h3 className="font-mono text-muted mb-4">RECENT INVESTIGATIONS</h3>
          <div className={styles.recentList}>
            <div className={`hud-card ${styles.recentItem}`}>
              <ShieldAlert className="text-danger" size={24} />
              <div className={styles.recentInfo}>
                <div className="font-serif text-accent">The Gilded Cage</div>
                <div className="text-muted text-sm">Mansion • Case #842</div>
              </div>
              <div className={styles.recentMeta}>
                <div className="flex items-center gap-1"><Users size={14} /> 3/8</div>
                <div className="text-accent text-sm">Waiting</div>
              </div>
              <button className={styles.joinSmallBtn} onClick={() => navigate('/lobby/NX-4209')}>JOIN</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoomPage;
