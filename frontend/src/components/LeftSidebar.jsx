import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Target, Settings, LogOut } from 'lucide-react';
import styles from './LeftSidebar.module.css';

const LeftSidebar = ({ caseInfo, showAccuse = false, roomCode }) => {
  const navigate = useNavigate();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topSection}>
        {caseInfo && (
          <div className={styles.caseInfo}>
            <div className={styles.thumbnail}></div>
            <div className={styles.caseDetails}>
              <div className={`${styles.caseLabel} font-mono`}>Case {caseInfo.number}</div>
              <div className={`${styles.caseName} font-serif`}>{caseInfo.name}</div>
            </div>
          </div>
        )}

        <nav className={styles.navIcons}>
          <button className={styles.navBtn} title="Players"><Users size={24} /></button>
          <button className={styles.navBtn} title="Evidence"><FileText size={24} /></button>
          <button className={styles.navBtn} title="Objectives"><Target size={24} /></button>
        </nav>
      </div>

      <div className={styles.bottomSection}>
        {showAccuse && (
          <button 
            className={styles.accuseBtn} 
            onClick={() => navigate(`/game/${roomCode}/vote`)}
          >
            ACCUSE NOW
          </button>
        )}
        <button className={styles.actionBtn}><Settings size={20} /> <span>Settings</span></button>
        <button className={styles.actionBtn} onClick={() => navigate('/')}><LogOut size={20} /> <span>Quit</span></button>
      </div>
    </aside>
  );
};

export default LeftSidebar;
