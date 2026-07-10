import React from 'react';
import { BrainCircuit } from 'lucide-react';
import styles from './AIRecapCard.module.css';

const AIRecapCard = ({ title = "AI SYNTHESIS", content, bulletPoints = [] }) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <BrainCircuit size={16} className="text-accent" />
        <span className="font-mono text-accent text-xs">{title}</span>
      </div>
      <div className={styles.body}>
        {content && <p className={styles.content}>{content}</p>}
        {bulletPoints.length > 0 && (
          <ul className={styles.list}>
            {bulletPoints.map((pt, idx) => (
              <li key={idx}>
                <span className={styles.bullet}></span>
                {pt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AIRecapCard;
