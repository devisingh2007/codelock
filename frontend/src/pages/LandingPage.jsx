import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Key, ArrowRight } from 'lucide-react';
import styles from './LandingPage.module.css';

// Game Assets
import backImg from '../assets/game/back.png';
import diaryImg from '../assets/game/diry.png';
import lensImg from '../assets/game/lens.png';
import polaroidImg from '../assets/game/image.png';
import fingerprintImg from '../assets/game/thumbprint.png';
import folderImg from '../assets/game/folder.png';
import maskImg from '../assets/game/mask.png';
import lampImg from '../assets/game/studylamp.png';
import forestDetectiveImg from '../assets/game/dec.png';

const DetectiveLogo = () => (
  <svg 
    width="28" 
    height="28" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="#b91c1c" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={{ filter: 'drop-shadow(0 0 5px rgba(185, 28, 28, 0.5))' }}
  >
    <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
    <path d="M12 2a4 4 0 0 0-4 4v1.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6a4 4 0 0 0-4-4z" fill="#b91c1c" fillOpacity="0.2" />
    <path d="M3 14c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v3H3v-3z" />
    <path d="M6 10h12" />
    <path d="M8 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" fill="#b91c1c" />
    <path d="M20 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" fill="#b91c1c" />
    <path d="M8 18h8" />
  </svg>
);

const TargetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
  </svg>
);

const BookIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(185, 28, 28, 0.5))' }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const LensIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(185, 28, 28, 0.5))' }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const UsersIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(185, 28, 28, 0.5))' }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* Header / Navbar */}
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <DetectiveLogo />
          <span className={styles.logoText}>MIDNIGHT <span>MURDER</span></span>
        </div>
        <nav className={styles.navLinks}>
          <a className={styles.navLink} onClick={() => navigate('/how-to-play')}>HOW TO PLAY</a>
          <a className={styles.navLink} onClick={() => navigate('/features')}>FEATURES</a>
          <a className={styles.navLink} onClick={() => navigate('/faq')}>FAQ</a>
          <button className={styles.joinNavBtn} onClick={() => navigate('/join')}>
            <Users size={16} /> JOIN ROOM
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className={styles.hero} style={{ backgroundImage: `url(${backImg})` }}>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>MIDNIGHT <span>MURDER</span></h1>
          <h2 className={styles.heroTagline}>CAN YOU CATCH THE KILLER?</h2>
          <p className={styles.heroDescription}>
            Gather your team, solve the mystery, uncover hidden motives, and catch the killer in a unique AI-generated investigation.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={() => navigate('/create')}>
              <Key size={18} /> CREATE ROOM
            </button>
            <button className={styles.secondaryBtn} onClick={() => navigate('/join')}>
              <Users size={18} /> JOIN ROOM
            </button>
          </div>
          <a className={styles.demoLink}>
            REQUEST A DEMO <ArrowRight size={14} />
          </a>
        </div>

      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <TargetIcon /> ENGINEERED FOR <span>INVESTIGATION</span> <TargetIcon />
          </div>
        </div>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <BookIcon />
            </div>
            <div className={styles.featureTextWrapper}>
              <h4>AI STORY GENERATOR</h4>
              <p>Dynamic narratives adapted to your choices.</p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <LensIcon />
            </div>
            <div className={styles.featureTextWrapper}>
              <h4>DYNAMIC CLUE SYSTEM</h4>
              <p>Evidence and clues evolve based on interrogation and discovery.</p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <UsersIcon />
            </div>
            <div className={styles.featureTextWrapper}>
              <h4>MULTIPLAYER INVESTIGATION</h4>
              <p>Collaborate or betray your fellow detectives. Trust no one.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Section */}
      <section className={styles.protocol}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            THE INVESTIGATION <span>PROTOCOL</span>
          </div>
          <img src={fingerprintImg} alt="Fingerprint" style={{ width: '20px', height: '20px', objectFit: 'contain', opacity: 0.8, marginLeft: '0.5rem' }} />
        </div>
        <div className={styles.protocolGrid}>
          <div className={styles.protocolCard}>
            <div className={styles.imageWrapper}>
              <img src={polaroidImg} alt="Create Room" className={styles.protocolImage} />
              <div className={styles.stepNumber}>01</div>
            </div>
            <h4>CREATE ROOM</h4>
            <p>Configure your case and investigation parameters.</p>
          </div>

          <div className={styles.protocolCard}>
            <div className={styles.imageWrapper}>
              <img src={fingerprintImg} alt="Join Players" className={styles.protocolImage} />
              <div className={styles.stepNumber}>02</div>
            </div>
            <h4>JOIN PLAYERS</h4>
            <p>Invite detectives and sync biometric data for the case.</p>
          </div>

          <div className={styles.protocolCard}>
            <div className={styles.imageWrapper}>
              <img src={folderImg} alt="Solve Mystery" className={styles.protocolImage} />
              <div className={styles.stepNumber}>03</div>
            </div>
            <h4>SOLVE MYSTERY</h4>
            <p>Gather intel, interrogate, and piece together the truth.</p>
          </div>

          <div className={styles.protocolCard}>
            <div className={styles.imageWrapper}>
              <img src={maskImg} alt="Reveal Murderer" className={styles.protocolImage} />
              <div className={styles.stepNumber}>04</div>
            </div>
            <h4>REVEAL MURDERER</h4>
            <p>Execute the protocol and expose the culprit.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaBox}>
          <div className={styles.ctaLeft}>
            <img src={lampImg} alt="Study Lamp" className={styles.ctaImg} />
          </div>

          <div className={styles.ctaCenter}>
            <div className={styles.ctaCenterIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 0 0-5 5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a5 5 0 0 0-5-5z" />
                <path d="M3 14h18a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1z" />
              </svg>
            </div>
            <h2>ARE YOU READY TO <span>STEP INTO THE DARK?</span></h2>
            <p>Join 10,000+ detectives solving AI-generated enigmas across the globe.</p>
            <button className={styles.ctaBtn} onClick={() => navigate('/join')}>
              START INVESTIGATION <img src={fingerprintImg} alt="Fingerprint" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>

          <div className={styles.ctaRight}>
            <img src={forestDetectiveImg} alt="Detective in Forest" className={styles.ctaImg} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          MIDNIGHT MURDER &copy; 2026. All rights reserved.
        </div>
        <div className={styles.footerSocials}>
          {/* Mock Socials */}
          <span className={styles.socialLink}>Discord</span>
          <span className={styles.socialLink}>Twitter</span>
          <span className={styles.socialLink}>Instagram</span>
          <span className={styles.socialLink}>Web</span>
        </div>
        <div className={styles.footerRight}>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
