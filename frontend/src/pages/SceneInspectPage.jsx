import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomActionBar from '../components/BottomActionBar';
import { Search } from 'lucide-react';
import styles from './SceneInspectPage.module.css';

const SceneInspectPage = () => {
  const { roomCode } = useParams();
  const [activeClue, setActiveClue] = useState(null);

  const clues = [
    { id: 1, x: 30, y: 45, label: 'Shattered Glass' },
    { id: 2, x: 65, y: 70, label: 'Torn Fabric' },
    { id: 3, x: 80, y: 30, label: 'Blood Splatter' },
  ];

  return (
    <div className={styles.pageLayout}>
      <LeftSidebar roomCode={roomCode} />

      <main className={styles.mainContent}>
        <div className={styles.sceneContainer}>
          <div className={styles.sceneImage}>
            {/* Interactive Clue Hotspots */}
            {clues.map(clue => (
              <div 
                key={clue.id}
                className={`${styles.hotspot} ${activeClue === clue.id ? styles.active : ''}`}
                style={{ left: `${clue.x}%`, top: `${clue.y}%` }}
                onMouseEnter={() => setActiveClue(clue.id)}
                onMouseLeave={() => setActiveClue(null)}
              >
                <div className={styles.hotspotCore}></div>
                <div className={styles.hotspotRing}></div>
                
                {activeClue === clue.id && (
                  <div className={styles.tooltip}>
                    <Search size={14} className="text-accent mb-1" />
                    <span className="font-mono text-xs">{clue.label}</span>
                    <span className="text-muted text-[10px] mt-1 block">Click to extract evidence</span>
                  </div>
                )}
              </div>
            ))}

            {/* Scanning HUD Overlay */}
            <div className={styles.scanLine}></div>
            <div className={styles.hudOverlay}>
              <div className="font-mono text-accent text-xs">FORENSIC SCAN: ACTIVE</div>
              <div className="font-mono text-muted text-xs mt-1">3 ANOMALIES DETECTED</div>
            </div>
          </div>
        </div>

        <BottomActionBar roomCode={roomCode} />
      </main>
    </div>
  );
};

export default SceneInspectPage;
