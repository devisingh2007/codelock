import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, User } from 'lucide-react';
import styles from './TopNavBar.module.css';

const TopNavBar = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={`${styles.logo} font-serif`}>MIDNIGHT MURDER</div>
      </div>
      
      <div className={styles.center}>
        <Link to="/" className={path === '/' ? styles.active : ''}>Home</Link>
        <Link to="/lobby/NX-4209" className={path.includes('/lobby') ? styles.active : ''}>Lobby</Link>
        <Link to="/profile" className={path.includes('/profile') ? styles.active : ''}>About</Link>
        <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn}><Settings size={20} /></button>
        <Link to="/profile" className={styles.iconBtn}><User size={20} /></Link>
      </div>
    </nav>
  );
};

export default TopNavBar;
