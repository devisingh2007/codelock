import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, AlertTriangle, Skull, Zap } from 'lucide-react';
import { autoAuthenticate, createRoom } from '../api/gameApi';
import styles from './CreateRoomPage.module.css';

/* ─── Scenario data ──────────────────────────────────────────────────────────── */
const SCENARIOS = [
  {
    id: 'mansion',
    label: 'Classic Mansion',
    emoji: '🏚️',
    tagline: 'Secrets rot behind locked doors',
    atmosphere: ['Victorian Noir', 'Storm-Lashed', 'Aristocratic Dread'],
    hook: 'A billionaire summons estranged heirs for a "reckoning weekend" at fog-drenched Blackwood Hall — and turns up dead before the will can be read.',
    victim: 'Lord Edmund Blackwood, 74, eccentric oil baron',
    setting: 'English countryside manor, 1924 ambience',
    weapon: 'Arsenic in the vintage brandy',
    clueCount: 18,
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #1a0a3e 0%, #05070c 60%)',
    bgEmoji: '🕯️',
  },
  {
    id: 'cruise',
    label: 'Luxury Cruise',
    emoji: '🛳️',
    tagline: 'Six hours from shore. Nowhere to run.',
    atmosphere: ['Mediterranean Glamour', 'Casino Intrigue', 'Deep-Sea Isolation'],
    hook: "A hedge-fund titan is found floating in the indoor pool of the MV Obsidian Star clutching a USB drive — and someone has hacked the ship's security cameras.",
    victim: 'Viktor Crane, 58, global financier',
    setting: 'Monaco → Istanbul, open Mediterranean',
    weapon: 'Forced drowning, security footage deleted',
    clueCount: 22,
    color: '#0369a1',
    gradient: 'linear-gradient(135deg, #0a1a3e 0%, #05070c 60%)',
    bgEmoji: '🌊',
  },
  {
    id: 'space',
    label: 'Space Station',
    emoji: '🛸',
    tagline: 'In zero gravity, no one hears the truth',
    atmosphere: ['Zero-G Horror', 'Corporate Espionage', 'Deep-Space Paranoia'],
    hook: 'Helix Station Omega: a classified research platform 450 km above Earth. Eight crew, a sabotaged escape pod, and a scientist dead in the airlock — file titled "COVER-UP_FINAL" still uploading.',
    victim: 'Dr. Yuki Tanaka, 42, lead research scientist',
    setting: 'Low Earth orbit, communication blackout',
    weapon: 'Deliberately reprogrammed oxygen regulator',
    clueCount: 16,
    color: '#0f766e',
    gradient: 'linear-gradient(135deg, #041a18 0%, #05070c 60%)',
    bgEmoji: '🌌',
  },
  {
    id: 'palace',
    label: 'Ancient Palace',
    emoji: '🏛️',
    tagline: 'Ancient power. Eternal betrayal.',
    atmosphere: ['Silk Road Intrigue', 'Royal Conspiracy', 'Ancient Mysticism'],
    hook: "The High Astronomer of Ashvapura is found with a ceremonial dagger through his star charts — and the Emperor's seal-ring is missing. No one leaves until the murderer confesses.",
    victim: 'Acharya Devraj, Royal Court Astronomer',
    setting: 'Grand Palace of Ashvapura, ancient empire',
    weapon: 'Bronze ceremonial dagger, poison-laced',
    clueCount: 20,
    color: '#b45309',
    gradient: 'linear-gradient(135deg, #2a1500 0%, #05070c 60%)',
    bgEmoji: '🪔',
  },
  {
    id: 'cyber',
    label: 'Cyber Crime',
    emoji: '💻',
    tagline: 'The most dangerous weapon is inside your own building',
    atmosphere: ['Tech-Noir', 'Hacker Underworld', 'Corporate Warfare'],
    hook: "Inside Nexus Corp's underground fortress, the legendary CTO is dead of a chemically-induced aneurysm. 140 TB of classified AI data is gone. The building is locked down. The killer is in this room.",
    victim: 'Zara Chen, 39, Chief Technology Officer',
    setting: 'Glass Citadel, San Francisco — 40 floors below street level',
    weapon: 'Nano-agent delivered via office coffee machine',
    clueCount: 24,
    color: '#dc2626',
    gradient: 'linear-gradient(135deg, #1a0000 0%, #05070c 60%)',
    bgEmoji: '⚡',
  },
  {
    id: 'hotel',
    label: 'Hotel Murder',
    emoji: '🏨',
    tagline: "The world's most exclusive hotel has one new guest — death",
    atmosphere: ['Paris Underworld', 'High Society', 'Criminal Elegance'],
    hook: "Suite 7 of The Obsidian Grand has no cameras and soundproof walls. Inside: a strangled criminal defence attorney whose client list includes three heads of state — and a missing briefcase.",
    victim: 'Maxime Delacroix, 55, criminal defence attorney',
    setting: 'The Obsidian Grand, central Paris, 3 a.m.',
    weapon: 'Garrotte wire, professional execution',
    clueCount: 19,
    color: '#9f1239',
    gradient: 'linear-gradient(135deg, #1a0010 0%, #05070c 60%)',
    bgEmoji: '🥂',
  },
];

const DIFFICULTY_META = {
  Easy: {
    label: 'Easy',
    icon: <Zap size={14} />,
    color: '#16a34a',
    desc: 'Fewer suspects, direct clue trails. Perfect for first-timers.',
    suspects: '3–4 suspects',
    redHerrings: 'Minimal red herrings',
  },
  Medium: {
    label: 'Medium',
    icon: <AlertTriangle size={14} />,
    color: '#d97706',
    desc: 'Balanced deduction with misdirection and layered motives.',
    suspects: '4–6 suspects',
    redHerrings: 'Moderate red herrings',
  },
  Hard: {
    label: 'Hard',
    icon: <Skull size={14} />,
    color: '#dc2626',
    desc: 'Complex alibis, layered conspiracies, and unreliable witnesses.',
    suspects: '6–8 suspects',
    redHerrings: 'Heavy deception',
  },
};

/* ─── Component ──────────────────────────────────────────────────────────────── */
const CreateRoomPage = () => {
  const navigate = useNavigate();
  const [alias, setAlias] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [partySize, setPartySize] = useState(6);
  const [scenario, setScenario] = useState('mansion');
  const [caseName, setCaseName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selected = SCENARIOS.find(s => s.id === scenario);
  const diffMeta = DIFFICULTY_META[difficulty];

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await autoAuthenticate(alias);
      const room = await createRoom({ scenario, difficulty, partySize });
      navigate(`/lobby/${room.roomCode}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageLayout}>
      <main className={styles.mainContent}>

        {/* ── LEFT: Form ─────────────────────────────────────────── */}
        <div className={styles.formContainer}>
          <div className={styles.formWrapper}>
            <button className={styles.backBtn} onClick={() => navigate('/')} type="button">
              <ArrowLeft size={16} /> Back to Dossier
            </button>

            <div className={styles.header}>
              <h1 className="font-serif">Initiate Investigation</h1>
              <p className="text-muted">Configure the crime scene, pick a story, and deploy your task force.</p>
              {error && <div className={styles.errorMsg}>{error}</div>}
            </div>

            <form onSubmit={handleCreate} className={styles.form}>
              {/* Row 1 — identity */}
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">HOST NAME</label>
                  <input
                    type="text"
                    placeholder="Enter your alias..."
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className="font-mono">CASE FILE NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. The Blackwood Affair"
                    value={caseName}
                    onChange={(e) => setCaseName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Scenario grid */}
              <div className={styles.fullRow}>
                <label className="font-mono">CHOOSE YOUR STORY</label>
                <div className={styles.scenarioGrid}>
                  {SCENARIOS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${styles.scenarioCard} ${scenario === s.id ? styles.scenarioActive : ''}`}
                      style={{ '--accent': s.color }}
                      onClick={() => setScenario(s.id)}
                      title={s.tagline}
                    >
                      <div className={styles.scenarioEmoji}>{s.emoji}</div>
                      <div className={styles.scenarioLabel}>{s.label}</div>
                      {scenario === s.id && <div className={styles.scenarioCheck}>✓</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty + party size */}
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">DIFFICULTY LEVEL</label>
                  <div className={styles.pills}>
                    {['Easy', 'Medium', 'Hard'].map(level => (
                      <button
                        key={level}
                        type="button"
                        className={`${styles.pill} ${difficulty === level ? styles.pillActive : ''}`}
                        style={difficulty === level ? { '--pill-color': DIFFICULTY_META[level].color } : {}}
                        onClick={() => setDifficulty(level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className="font-mono">TASK FORCE SIZE</label>
                  <div className={styles.stepper}>
                    <button type="button" onClick={() => setPartySize(Math.max(2, partySize - 1))}>−</button>
                    <span className={`${styles.stepperNum} font-mono`}>{partySize}</span>
                    <button type="button" onClick={() => setPartySize(Math.min(8, partySize + 1))}>+</button>
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <span className={styles.loadingDots}>INITIALISING<span>.</span><span>.</span><span>.</span></span>
                ) : (
                  <>DEPLOY TASK FORCE <ChevronRight size={18} /></>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Story Preview Panel ─────────────────────────── */}
        <div
          className={styles.storyPanel}
          style={{ '--accent': selected?.color, background: selected?.gradient }}
          key={scenario}
        >
          {/* decorative background glyph */}
          <div className={styles.bgGlyph}>{selected?.bgEmoji}</div>

          <div className={styles.storyPanelInner}>
            {/* top bar */}
            <div className={styles.panelTopBar}>
              <div className={`${styles.liveBadge} font-mono`}>
                <span className={styles.dot} />
                CASE FILE ACTIVE
              </div>
              <div className={styles.cluesBadge}>
                <span className={styles.cluesNum}>{selected?.clueCount}</span>
                <span className={styles.cluesWord}>CLUES</span>
              </div>
            </div>

            {/* scenario identity */}
            <div className={styles.scenarioIdentity}>
              <div className={styles.panelEmoji}>{selected?.emoji}</div>
              <div>
                <h2 className={styles.panelTitle}>{selected?.label}</h2>
                <p className={styles.panelTagline}>"{selected?.tagline}"</p>
              </div>
            </div>

            {/* divider */}
            <div className={styles.divider} />

            {/* hook */}
            <p className={styles.panelHook}>{selected?.hook}</p>

            {/* details grid */}
            <div className={styles.detailsGrid}>
              <div className={styles.detailCard}>
                <span className={styles.detailIcon}>☠</span>
                <span className={styles.detailKey}>VICTIM</span>
                <span className={styles.detailVal}>{selected?.victim}</span>
              </div>
              <div className={styles.detailCard}>
                <span className={styles.detailIcon}>📍</span>
                <span className={styles.detailKey}>LOCATION</span>
                <span className={styles.detailVal}>{selected?.setting}</span>
              </div>
              <div className={styles.detailCard}>
                <span className={styles.detailIcon}>🔪</span>
                <span className={styles.detailKey}>MURDER WEAPON</span>
                <span className={styles.detailVal}>{selected?.weapon}</span>
              </div>
              <div className={styles.detailCard} style={{ '--accent': diffMeta?.color }}>
                <span className={styles.detailIcon}>{diffMeta?.icon}</span>
                <span className={styles.detailKey}>DIFFICULTY</span>
                <span className={styles.detailValAccent}>{diffMeta?.label} — {diffMeta?.desc}</span>
              </div>
            </div>

            {/* difficulty quick-stats */}
            <div className={styles.diffStats}>
              <div className={styles.diffStat} style={{ '--c': diffMeta?.color }}>
                <span>👥</span> {diffMeta?.suspects}
              </div>
              <div className={styles.diffStat} style={{ '--c': diffMeta?.color }}>
                <span>🎭</span> {diffMeta?.redHerrings}
              </div>
              <div className={styles.diffStat} style={{ '--c': diffMeta?.color }}>
                <span>🔍</span> {selected?.clueCount} hidden clues
              </div>
            </div>

            {/* atmosphere tags */}
            <div className={styles.atmosphereTags}>
              {selected?.atmosphere.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default CreateRoomPage;
