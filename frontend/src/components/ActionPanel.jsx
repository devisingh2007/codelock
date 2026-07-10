import React, { useState } from 'react';
import styles from './ActionPanel.module.css';

const ActionPanel = ({ onAction }) => {
  const [selectedAction, setSelectedAction] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const handleActionClick = (action) => {
    setSelectedAction(action);
    setToastMessage(`Action "${action}" selected.`);
    
    if (onAction) {
      onAction(action);
    }

    setTimeout(() => {
      setSelectedAction(null);
      setToastMessage('');
    }, 2000);
  };

  return (
    <div className={styles.actionPanel}>
      <h2 className={styles.title}>Actions</h2>
      
      <div className={styles.buttonGrid}>
        <button 
          className={`${styles.actionBtn} ${selectedAction === 'Ask Question' ? styles.selected : ''}`}
          onClick={() => handleActionClick('Ask Question')}
        >
          Ask Question
        </button>
        <button 
          className={`${styles.actionBtn} ${selectedAction === 'Request Evidence' ? styles.selected : ''}`}
          onClick={() => handleActionClick('Request Evidence')}
        >
          Request Evidence
        </button>
        <button 
          className={`${styles.actionBtn} ${selectedAction === 'Defend' ? styles.selected : ''}`}
          onClick={() => handleActionClick('Defend')}
        >
          Defend
        </button>
        <button 
          className={`${styles.actionBtn} ${styles.dangerBtn} ${selectedAction === 'Accuse' ? styles.selected : ''}`}
          onClick={() => handleActionClick('Accuse')}
        >
          Accuse
        </button>
        <button 
          className={`${styles.actionBtn} ${styles.primaryBtn} ${selectedAction === 'Vote' ? styles.selected : ''}`}
          onClick={() => handleActionClick('Vote')}
        >
          Vote
        </button>
      </div>

      {toastMessage && (
        <div className={styles.toast}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ActionPanel;
