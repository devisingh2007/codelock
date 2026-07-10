import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import styles from './PlayerCard.module.css';

const PlayerCard = ({ player, showKickBtn = false, onKick }) => {
  return (
    <div className={`${styles.card} ${player.status === 'ELIMINATED' ? styles.eliminated : ''}`}>
      {showKickBtn && (
        <button 
          className={styles.kickBtn} 
          onClick={(e) => {
            e.stopPropagation();
            onKick(player.id, player.name);
          }}
          title="Kick Player"
        >
          &times;
        </button>
      )}
      <div className={styles.avatar}>
        {player.initials}
      </div>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{player.name}</span>
          {player.isHost && <span className={styles.hostTag}>HOST</span>}
          {player.isMe && <span className={styles.youTag}>YOU</span>}
        </div>
        
        <div className={styles.statusRow}>
          {player.micStatus === 'on' ? (
            <Mic size={14} className={styles.micOn} />
          ) : (
            <MicOff size={14} className={styles.micOff} />
          )}
          <span className={`${styles.statusText} ${styles[player.status.toLowerCase().replace('...', '')] || ''} font-mono`}>
            {player.status === 'COMMUNICATING' && <span className={styles.statusDot}></span>}
            {player.status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
