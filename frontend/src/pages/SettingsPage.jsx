import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Volume2, Globe, Shield, Monitor } from 'lucide-react';
import styles from './SettingsPage.module.css';

const SettingsPage = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    voiceMode: false,
    textSpeed: 'Normal',
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 100,
    highContrast: document.body.classList.contains('high-contrast')
  });

  const handleToggle = (key) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'highContrast') {
        if (next.highContrast) {
          document.body.classList.add('high-contrast');
        } else {
          document.body.classList.remove('high-contrast');
        }
      }
      return next;
    });
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className={styles.pageLayout}>
      <main className={styles.mainContent}>
        <div className={styles.formContainer}>
          <div className={styles.header}>
            <div className="flex items-center gap-2 mb-2 text-accent">
              <Settings size={28} />
              <h1 className="font-serif text-3xl">System Configuration</h1>
            </div>
            <p className="text-muted">Adjust protocol parameters</p>
          </div>

          <form onSubmit={handleSave} className={styles.form}>
            {/* Communication Group */}
            <div className={styles.sectionBox}>
              <h3 className="font-mono text-muted mb-4 flex items-center gap-2">
                <Globe size={18} /> COMMUNICATIONS
              </h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">LANGUAGE PROTOCOL</label>
                  <select 
                    value={settings.language} 
                    onChange={(e) => handleChange('language', e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className="font-mono">VOICE MODE</label>
                  <div className={styles.toggleGroup}>
                    <span className={settings.voiceMode ? "text-primary" : "text-muted"}>
                      {settings.voiceMode ? "Enabled" : "Disabled"}
                    </span>
                    <label className={styles.switch}>
                      <input 
                        type="checkbox" 
                        checked={settings.voiceMode} 
                        onChange={() => handleToggle('voiceMode')} 
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Group */}
            <div className={styles.sectionBox}>
              <h3 className="font-mono text-muted mb-4 flex items-center gap-2">
                <Volume2 size={18} /> AUDIO LEVELS
              </h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">MASTER MUTE</label>
                  <div className={styles.toggleGroup}>
                    <span className={settings.audioMuted ? "text-danger" : "text-muted"}>
                      {settings.audioMuted ? "Muted" : "Active"}
                    </span>
                    <label className={styles.switch}>
                      <input 
                        type="checkbox" 
                        checked={settings.audioMuted} 
                        onChange={() => handleToggle('audioMuted')} 
                      />
                      <span className={`${styles.slider} ${styles.dangerSlider}`}></span>
                    </label>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label className="font-mono">SFX VOLUME</label>
                  <div className={styles.stepper}>
                    <button type="button" onClick={() => handleChange('sfxVolume', Math.max(0, settings.sfxVolume - 10))}>-</button>
                    <span className="font-mono">{settings.sfxVolume}%</span>
                    <button type="button" onClick={() => handleChange('sfxVolume', Math.min(100, settings.sfxVolume + 10))}>+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Display Group */}
            <div className={styles.sectionBox}>
              <h3 className="font-mono text-muted mb-4 flex items-center gap-2">
                <Monitor size={18} /> DISPLAY
              </h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className="font-mono">HIGH CONTRAST MODE</label>
                  <div className={styles.toggleGroup}>
                    <span className={settings.highContrast ? "text-primary" : "text-muted"}>
                      {settings.highContrast ? "Enabled" : "Disabled"}
                    </span>
                    <label className={styles.switch}>
                      <input 
                        type="checkbox" 
                        checked={settings.highContrast} 
                        onChange={() => handleToggle('highContrast')} 
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={() => navigate('/')}>CANCEL</button>
              <button type="submit" className={styles.submitBtn}>SAVE SETTINGS</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
