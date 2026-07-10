import React from 'react';
import { Eye, Search, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './BottomActionBar.module.css';

const BottomActionBar = ({ roomCode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isActive = (targetPath) => {
    if (targetPath === 'ask' && (path === `/game/${roomCode}` || path === `/game/${roomCode}/`)) return true;
    if (path.includes(targetPath)) return true;
    return false;
  };

  return (
    <div className={styles.actionBar}>
      <button 
        className={`${styles.actionBtn} ${isActive('inspect') ? styles.active : ''}`}
        onClick={() => navigate(`/game/${roomCode}/inspect`)}
      >
        <div className={styles.iconWrapper}><Eye size={20} /></div>
        <span>Inspect</span>
      </button>

      <button 
        className={`${styles.actionBtn} ${isActive('board') ? styles.active : ''}`}
        onClick={() => navigate(`/game/${roomCode}/board`)}z
      >
        <div className={styles.iconWrapper}><Search size={20} /></div>
        <span>Search</span>
      </button>

      <button 
        className={`${styles.actionBtn} ${isActive('ask') ? styles.active : ''}`}
        onClick={() => navigate(`/game/${roomCode}`)}
      >
        <div className={styles.iconWrapper}><MessageSquare size={20} /></div>
        <span>Ask AI</span>
      </button>

      <button 
        className={`${styles.actionBtn} ${isActive('vote') ? styles.active : ''}`}
        onClick={() => navigate(`/game/${roomCode}/vote`)}
      >
        <div className={styles.iconWrapper}><AlertTriangle size={20} /></div>
        <span>Accuse</span>
      </button>

      <button 
        className={`${styles.actionBtn} ${isActive('meeting') ? styles.active : ''}`}
        onClick={() => navigate(`/game/${roomCode}`)}
      >
        <div className={styles.iconWrapper}><Users size={20} /></div>
        <span>Meeting</span>
      </button>
    </div>
  );
};

export default BottomActionBar;
