import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomActionBar from '../components/BottomActionBar';
import { Search, CheckCircle } from 'lucide-react';
import { getEvidence } from '../api/gameApi';
import styles from './SceneInspectPage.module.css';

const DEFAULT_POSITIONS = [
  { x: 28, y: 42 },
  { x: 62, y: 68 },
  { x: 78, y: 28 },
  { x: 18, y: 70 },
  { x: 50, y: 50 },
];

const SceneInspectPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [activeClue, setActiveClue] = useState(null);
  const [extracted, setExtracted] = useState(new Set());
  const [clues, setClues] = useState([]);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    const fetchEvidence = async () => {
      const data = await getEvidence(roomCode);
      const revealed = data.filter(e => e.status === 'revealed');
      const mapped = revealed.map((e, idx) => ({
        id: e.id,
        label: e.name,
        desc: e.description || 'A piece of evidence. Examine it carefully.',
        x: DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length].x,
        y: DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length].y,
      }));
      setClues(mapped);
      setAnomalyCount(mapped.length);
    };
    fetchEvidence();
  }, [roomCode]);

  const handleExtract = (clue) => {
    setExtracted(prev => new Set([...prev, clue.id]));
    setActiveClue(null);
  };

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
                className={`${styles.hotspot} ${activeClue === clue.id ? styles.active : ''} ${extracted.has(clue.id) ? styles.done : ''}`}
                style={{ left: `${clue.x}%`, top: `${clue.y}%` }}
                onMouseEnter={() => setActiveClue(clue.id)}
                onMouseLeave={() => setActiveClue(null)}
                onClick={() => handleExtract(clue)}
              >
                <div className={styles.hotspotCore}>
                  {extracted.has(clue.id) ? <CheckCircle size={14} color="#22c55e" /> : null}
                </div>
                <div className={styles.hotspotRing}></div>

                {activeClue === clue.id && !extracted.has(clue.id) && (
                  <div className={styles.tooltip}>
                    <Search size={14} className="text-accent mb-1" />
                    <span className="font-mono text-xs">{clue.label}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{clue.desc}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: '#f2c14e', marginTop: '4px' }}>Click to extract</span>
                  </div>
                )}
                {activeClue === clue.id && extracted.has(clue.id) && (
                  <div className={styles.tooltip}>
                    <span className="font-mono text-xs" style={{ color: '#22c55e' }}>✓ EXTRACTED</span>
                  </div>
                )}
              </div>
            ))}

            {/* Scanning HUD Overlay */}
            <div className={styles.scanLine}></div>
            <div className={styles.hudOverlay}>
              <div className="font-mono text-accent text-xs">FORENSIC SCAN: ACTIVE</div>
              <div className="font-mono text-muted text-xs mt-1">
                {anomalyCount} ANOMALIES DETECTED — {extracted.size} EXTRACTED
              </div>
            </div>
          </div>
        </div>

        <BottomActionBar roomCode={roomCode} />
      </main>
    </div>
  );
};

export default SceneInspectPage;
