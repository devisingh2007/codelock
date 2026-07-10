import React from 'react';
import SuspicionMeter from './SuspicionMeter';
import styles from './SuspectVoteCard.module.css';

const SuspectVoteCard = ({ suspect, onVote }) => {
  return (
    <div className={`${styles.card} ${suspect.isMe ? styles.isMe : ''}`}>
      <div className={styles.avatar}>
        {suspect.name.charAt(0)}
      </div>
      <div className={styles.info}>
        <div className={`${styles.name} font-serif`}>{suspect.name}</div>
        <div className={styles.role}>{suspect.role}</div>
      </div>
      <div className={styles.voteCount}>
        <span className={styles.dot}></span>
        {suspect.votes} Votes
      </div>

      <div className={styles.meterWrapper}>
        <SuspicionMeter level={suspect.suspicionLevel || 50} label="SUSPICION" />
      </div>
      
      {suspect.isMe ? (
        <button className={styles.disabledBtn} disabled>
          CANNOT VOTE SELF
        </button>
      ) : (
        <button className={styles.voteBtn} onClick={() => onVote(suspect.id)}>
          CAST VOTE
        </button>
      )}

      {suspect.isMe && <div className={styles.youBadge}>YOU</div>}
    </div>
  );
};

export default SuspectVoteCard;
