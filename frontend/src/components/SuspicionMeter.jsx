import React from 'react';
import styles from './SuspicionMeter.module.css';

const SuspicionMeter = ({ level, label, variant = 'bar' }) => {
  // level is a percentage (0-100)
  
  const getDangerColor = (val) => {
    if (val > 75) return 'var(--danger-color)';
    if (val > 40) return 'var(--accent-color)';
    return 'var(--success-color)';
  };

  const getDangerText = (val) => {
    if (val > 75) return 'HIGH';
    if (val > 40) return 'MEDIUM';
    return 'LOW';
  };

  const color = getDangerColor(level);
  
  if (variant === 'text') {
    return (
      <div className={styles.textMode}>
        <span className="font-mono text-muted text-xs">{label}:</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{getDangerText(level)}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="font-mono text-xs text-muted">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>{level}%</span>
      </div>
      <div className={styles.barBackground}>
        <div 
          className={styles.barFill} 
          style={{ 
            width: `${level}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        ></div>
      </div>
    </div>
  );
};

export default SuspicionMeter;
