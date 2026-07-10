import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Search, Users, Crosshair, Trophy } from 'lucide-react';
import styles from './HowToPlayPage.module.css';

const steps = [
  {
    number: '01',
    icon: <Shield size={28} />,
    title: 'Secure Your Identity',
    subtitle: 'ALIAS CREATION',
    desc: 'Enter a detective alias to join or create a private investigation room. Your alias is your badge — choose wisely.',
    detail: 'The host creates the room, shares the 6-character Room Code with up to 7 other detectives. Each player joins with a unique alias that persists for the session.',
  },
  {
    number: '02',
    icon: <Search size={28} />,
    title: 'Establish Scene Parameters',
    subtitle: 'CASE CONFIGURATION',
    desc: 'The host selects the scenario, difficulty, and party size before the investigation begins.',
    detail: 'Scenarios range from Classic Mansion to Luxury Cruise Ship. Difficulty controls how many red herrings the AI plants. Easy = fewer suspects; Master = everyone looks guilty.',
  },
  {
    number: '03',
    icon: <Users size={28} />,
    title: 'Analyse the Case File',
    subtitle: 'CHARACTER DOSSIERS',
    desc: 'Each player receives a secret character card — their role, motive, alibi, and one private clue.',
    detail: 'Only you can see your character sheet. Share (or lie about) information during the investigation. The murderer knows they did it — and will try to mislead you.',
  },
  {
    number: '04',
    icon: <Crosshair size={28} />,
    title: 'Interrogate & Gather Evidence',
    subtitle: 'LIVE INVESTIGATION',
    desc: 'Use the real-time chat and shared Evidence Board to cross-examine suspects, pin clues, and build your theory.',
    detail: 'All messages are broadcast instantly via Socket.IO. Use the Evidence Board to mark clues as Verified, Discussed, or Suspicious. Time is limited — collaborate efficiently.',
  },
  {
    number: '05',
    icon: <Trophy size={28} />,
    title: 'Accusation Protocol',
    subtitle: 'VOTE TO CONVICT',
    desc: 'When the host opens voting, every detective submits their final accusation. Majority rules.',
    detail: 'The AI reveals the true murderer, motive, and timeline. The debrief screen shows your team accuracy, clue impact, and awards individual badges for standout performance.',
  },
];

const HowToPlayPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className={styles.container}>
      {/* Header */}
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
        {/* Title */}
        <div className={styles.titleSection}>
          <p className={styles.category}>⚠ CLASSIFIED PROTOCOL</p>
          <h1 className={styles.title}>How to Play</h1>
          <p className={styles.subtitle}>
            Five stages separate you from solving the perfect murder.
            Follow the protocol. Trust no one. Convict wisely.
          </p>
        </div>

        {/* Timeline */}
        <div className={styles.timeline}>
          {steps.map((step, idx) => (
            <div
              key={step.number}
              className={`${styles.step} ${activeStep === idx ? styles.stepActive : ''}`}
              onClick={() => setActiveStep(activeStep === idx ? null : idx)}
            >
              {/* Connector line */}
              {idx < steps.length - 1 && <div className={styles.connector} />}

              {/* Step number badge */}
              <div className={styles.stepBadge}>{step.number}</div>

              <div className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <div className={styles.stepIcon}>{step.icon}</div>
                  <div className={styles.stepMeta}>
                    <span className={styles.stepSubtitle}>{step.subtitle}</span>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                  </div>
                  <div className={`${styles.chevron} ${activeStep === idx ? styles.chevronOpen : ''}`}>▾</div>
                </div>

                <p className={styles.stepDesc}>{step.desc}</p>

                {activeStep === idx && (
                  <div className={styles.stepDetail}>
                    <p>{step.detail}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={() => navigate('/create')}>
            BEGIN INVESTIGATION →
          </button>
          <button className={styles.ctaGhost} onClick={() => navigate('/join')}>
            JOIN EXISTING CASE
          </button>
        </div>
      </main>
    </div>
  );
};

export default HowToPlayPage;
