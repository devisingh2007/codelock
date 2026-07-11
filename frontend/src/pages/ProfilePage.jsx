import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import { getProfile } from '../api/gameApi';
import { Award, Target, BrainCircuit, Clock } from 'lucide-react';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const data = await getProfile();
      // Personalize with the actual logged-in player's name
      const realName = sessionStorage.getItem('username') || data.name;
      setProfile({ ...data, name: realName });
    };
    fetchProfile();
  }, []);

  if (!profile) return <div className={styles.loading}>Loading Dossier...</div>;

  return (
    <div className={styles.pageLayout}>
      <TopNavBar />

      <main className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className="font-serif text-4xl text-accent mb-2">DETECTIVE DOSSIER</h1>
          <p className="font-mono text-muted tracking-widest">{profile.name}</p>
        </div>

        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <div className={`hud-card ${styles.profileCard}`}>
              <div className={styles.avatarPlaceholder}>
                <UserAvatar initials={profile.name.substring(0, 2).toUpperCase()} />
              </div>
              <h2 className="font-serif text-2xl mb-1">{profile.name}</h2>
              <p className="text-accent font-mono mb-6">{profile.rank}</p>

              <div className={styles.statsList}>
                <div className={styles.statRow}>
                  <div className="flex items-center gap-2 text-muted">
                    <Target size={16} /> Cases Solved
                  </div>
                  <span className="font-mono text-lg">{profile.stats.casesSolved}</span>
                </div>
                <div className={styles.statRow}>
                  <div className="flex items-center gap-2 text-muted">
                    <BrainCircuit size={16} /> Correct Accusations
                  </div>
                  <span className="font-mono text-lg">{profile.stats.correctAccusations}</span>
                </div>
                <div className={styles.statRow}>
                  <div className="flex items-center gap-2 text-muted">
                    <Clock size={16} /> Playtime
                  </div>
                  <span className="font-mono text-lg">{profile.stats.playtime}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rightCol}>
            <div className={`hud-card ${styles.achievementsCard}`}>
              <h3 className="font-mono text-muted mb-6 flex items-center gap-2">
                <Award size={20} /> ACHIEVEMENTS
              </h3>
              
              <div className={styles.achievementsGrid}>
                {profile.achievements.map((ach, idx) => (
                  <div key={idx} className={`${styles.achievementItem} ${!ach.unlocked ? styles.locked : ''}`}>
                    <div className={styles.achIcon}>
                      <Award size={24} className={ach.unlocked ? 'text-accent' : 'text-muted'} />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg">{ach.name}</h4>
                      <p className="text-muted text-sm">{ach.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const UserAvatar = ({ initials }) => (
  <div style={{
    width: '120px', height: '120px', borderRadius: '50%', 
    backgroundColor: '#1c2331', border: '2px solid var(--accent-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '3rem', fontWeight: 'bold', color: 'var(--text-secondary)'
  }}>
    {initials}
  </div>
);

export default ProfilePage;
