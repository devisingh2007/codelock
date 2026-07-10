import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, User } from 'lucide-react';
import styles from './TopNavBar.module.css';

const TopNavBar = () => {
  const location = useLocation();
  const path = location.pathname;

  const handleNavigation = (e) => {
    if (path.includes('/lobby') || path.includes('/game')) {
      const confirmLeave = window.confirm("Are you sure you want to leave? You will be disconnected from the current room.");
      if (!confirmLeave) {
        e.preventDefault();
      }
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={`${styles.logo} font-serif`}>MIDNIGHT MURDER</div>
      </div>
      
      <div className={styles.center}>
        <Link to="/" onClick={handleNavigation} className={path === '/' ? styles.active : ''}>Home</Link>
        <Link to="/profile" onClick={handleNavigation} className={path.includes('/profile') ? styles.active : ''}>About</Link>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn}><Settings size={20} /></button>
        <Link to="/profile" onClick={handleNavigation} className={styles.iconBtn}><User size={20} /></Link>
      </div>
    </nav>
  );
};

export default TopNavBar;
