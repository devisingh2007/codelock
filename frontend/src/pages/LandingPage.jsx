import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Search, Users, ShieldAlert } from 'lucide-react';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <div className={styles.hudTopLeft}>
            
          </div>
          
          <h1 className={`${styles.logoWordmark} font-serif glow-accent`}>MIDNIGHT MURDER</h1>
          <h2 className={styles.tagline}>Can You Catch the Killer?</h2>
          <p className={styles.subtext}>Gather your team, solve the mystery, uncover hidden motives, and catch the killer in a unique AI-generated investigation.</p>
          
          <div className={styles.actionGroup}>
            <button className={styles.primaryBtn} onClick={() => navigate('/create')}>
              CREATE ROOM
            </button>
            <button className={styles.dangerBtn} onClick={() => navigate('/join')}>
              JOIN ROOM
            </button>
          </div>
          
          <button className={styles.ghostBtn}>REQUEST A DEMO</button>

          <div className={styles.hudBottomRight}>
            <div className="font-mono text-muted blink">WAITING FOR PLAYER INPUT...</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <h3 className={`${styles.sectionTitle} font-mono`}>ENGINEERED FOR INVESTIGATION</h3>
        <div className={styles.featureGrid}>
          <div className="hud-card">
            <BrainCircuit className="text-accent mb-4" size={32} />
            <h4>AI Story Generator</h4>
            <p className="text-muted">Dynamic narratives adapted to your choices.</p>
          </div>
          <div className="hud-card">
            <Search className="text-accent mb-4" size={32} />
            <h4>Dynamic Clue System</h4>
            <p className="text-muted">Evidence changes based on interrogation.</p>
          </div>
          <div className="hud-card">
            <Users className="text-accent mb-4" size={32} />
            <h4>Multiplayer Investigation</h4>
            <p className="text-muted">Collaborate or betray your fellow detectives.</p>
          </div>
        </div>
      </section>

      {/* Protocol Section */}
      <section className={styles.protocol}>
        <h3 className={`${styles.sectionTitle} font-mono`}>THE INVESTIGATION PROTOCOL</h3>
        <div className={styles.protocolSteps}>
          {[
            { num: '01', title: 'Create Room', desc: 'Configure case parameters' },
            { num: '02', title: 'Join Players', desc: 'Sync biometric data' },
            { num: '03', title: 'Solve Mystery', desc: 'Gather intel & evidence' },
            { num: '04', title: 'Reveal Murderer', desc: 'Execute the protocol' }
          ].map(step => (
            <div key={step.num} className={styles.step}>
              <div className={`${styles.stepNum} font-mono`}>{step.num}</div>
              <h4>{step.title}</h4>
              <p className="text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className="hud-card text-center">
          <ShieldAlert size={48} className="text-danger mx-auto mb-4" />
          <h2 className="font-serif text-2xl mb-2">Are you ready to step into the dark?</h2>
          <p className="text-muted mb-6">Join 10,000+ detectives solving AI-generated enigmas across the globe</p>
          <button className={styles.primaryBtn} onClick={() => navigate('/join')}>
            START INVESTIGATION
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="font-serif">MIDNIGHT MURDER &copy; 2026</div>
        <div className={styles.footerLinks}>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
