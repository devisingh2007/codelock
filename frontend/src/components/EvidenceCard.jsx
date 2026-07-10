import React from 'react';
import { FileText, Database, Fingerprint, Lock } from 'lucide-react';
import styles from './EvidenceCard.module.css';

const iconMap = {
  document: FileText,
  sample: Database,
  fingerprint: Fingerprint,
  lock: Lock,
};

const EvidenceCard = ({ evidence }) => {
  const Icon = iconMap[evidence.icon] || FileText;

  if (evidence.status === 'locked') {
    return (
      <div className={`${styles.card} ${styles.locked}`}>
        <div className={styles.iconContainer}>
          <Icon size={24} />
        </div>
        <div className={`${styles.name} font-mono`}>???</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.iconContainer}>
        <Icon size={24} />
      </div>
      <div className={styles.name}>{evidence.name}</div>
    </div>
  );
};

export default EvidenceCard;
