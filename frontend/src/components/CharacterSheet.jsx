import React from 'react';
import { Lock } from 'lucide-react';
import styles from './CharacterSheet.module.css';

const CharacterSheet = ({ character }) => {
  if (!character) return null;

  return (
    <div className={styles.characterSheet}>
      <div className={styles.privateBanner}>
        <Lock size={14} />
        <span>Only visible to you</span>
      </div>
      
      <div className={styles.header}>
        <h2 className={styles.name}>{character.name}</h2>
        <div className={styles.divider}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Background</h3>
          <p className={`${styles.text} font-serif`}>{character.background}</p>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Objective</h3>
          <p className={`${styles.text} font-serif`}>{character.objective}</p>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Your Secrets</h3>
          <ul className={styles.secretsList}>
            {character.secrets.map((secret, index) => (
              <li key={index} className={`${styles.text} font-serif`}>
                {secret}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CharacterSheet;
