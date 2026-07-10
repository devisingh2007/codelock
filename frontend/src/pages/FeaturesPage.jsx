import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, Zap, LayoutDashboard, ClipboardList } from 'lucide-react';
import styles from './FeaturesPage.module.css';

const features = [
  {
    icon: <Cpu size={24} />,
    title: 'OLLAMA AI ENGINE',
    description: 'Every mystery is uniquely generated at runtime by a local Ollama large-language model. No two investigations are ever identical.',
    specs: [
      '→ Configurable model (llama3, mistral, phi3)',
      '→ Structured JSON mystery schema validation',
      '→ Per-room rate limiting (6 req/min)',
      '→ Adjustable difficulty alters clue density',
    ],
  },
  {
    icon: <Zap size={24} />,
    title: 'SOCKET.IO REAL-TIME',
    description: 'All player actions, chat messages, and game state transitions are synchronized in real-time across every connected client.',
    specs: [
      '→ JWT-authenticated handshakes',
      '→ Per-socket rate limiting (10 msg / 5s)',
      '→ Versioned state updates (conflict-free)',
      '→ Auto-reconnect with ping/pong heartbeat',
    ],
  },
  {
    icon: <LayoutDashboard size={24} />,
    title: 'COMMAND CENTER HUD',
    description: 'A glassmorphic dark-crimson interface built for immersion — styled like a Victorian detective\'s control room with live feeds.',
    specs: [
      '→ Playfair Display serif + Roboto Mono typography',
      '→ CSS module architecture (zero class conflicts)',
      '→ Fully animated page transitions & micro-interactions',
      '→ High-contrast accessibility mode',
    ],
  },
  {
    icon: <ClipboardList size={24} />,
    title: 'SHARED EVIDENCE BOARD',
    description: 'A collaborative corkboard where all players pin, discuss, and mark clues. State is persisted in MongoDB and synced live.',
    specs: [
      '→ Clue status: New / Discussed / Verified / Ignored',
      '→ Filter by type: Physical, Witness, Time-Related',
      '→ Visual red-string SVG connections',
      '→ Full case debrief with accuracy scores on game end',
    ],
  },
];

const FeaturesPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <div className={styles.logoBadge}>🔍</div>
          <span className={styles.logoText}>MIDNIGHT <span>MURDER</span></span>
        </div>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Dossier
        </button>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.titleSection}>
          <p className={styles.category}>⚙ SYSTEM SPECIFICATIONS</p>
          <h1 className={styles.title}>Engine Features</h1>
          <p className={styles.subtitle}>
            Built on a full-stack Node.js + React architecture. 
            Every component is engineered for real-time multiplayer mystery gaming.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map((f, idx) => (
            <div className={styles.featureCard} key={idx}>
              <div className={styles.cardHeader}>
                <div className={styles.iconCircle}>{f.icon}</div>
                <h3>{f.title}</h3>
              </div>
              <p className={styles.description}>{f.description}</p>
              <ul className={styles.specList}>
                {f.specs.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={() => navigate('/create')}>
            LAUNCH INVESTIGATION →
          </button>
        </div>
      </main>
    </div>
  );
};

export default FeaturesPage;
