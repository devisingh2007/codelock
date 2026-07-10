import React, { useRef, useEffect } from 'react';
import AIRecapCard from './AIRecapCard';
import styles from './InvestigationFeed.module.css';

const InvestigationFeed = ({ messages }) => {
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessage = (msg) => {
    switch (msg.type) {
      case 'event':
        return (
          <div key={msg.id} className={`${styles.message} ${styles.event}`}>
            <span className={`${styles.time} font-mono`}>{msg.timestamp}</span>
            <div className={styles.content}>{msg.content}</div>
          </div>
        );
      case 'divider':
        return (
          <div key={msg.id} className={styles.divider}>
            <span className={`${styles.dividerTime} font-mono`}>{msg.timestamp}</span>
            <span className={styles.dividerText}>{msg.content}</span>
          </div>
        );
      case 'narrative':
        return (
          <div key={msg.id} className={`${styles.message} ${styles.narrative} font-serif`}>
            {msg.content}
          </div>
        );
      case 'question':
      case 'accusation':
        return (
          <div key={msg.id} className={`${styles.message} ${msg.type === 'accusation' ? styles.accusation : styles.question}`}>
            <div className={styles.header}>
              <span className={styles.playerName}>{msg.playerName}</span>
              <span className={`${styles.time} font-mono`}>{msg.timestamp}</span>
            </div>
            <div className={styles.content}>{msg.content}</div>
          </div>
        );
      case 'answer':
        return (
          <div key={msg.id} className={`${styles.message} ${styles.gmMessage}`}>
            <div className={styles.header}>
              <span className={`${styles.gmName} font-mono`}>GAME MASTER</span>
              <span className={`${styles.time} font-mono`}>{msg.timestamp}</span>
            </div>
            <div className={styles.content}>{msg.content}</div>
          </div>
        );
      case 'ai_recap':
        return (
          <AIRecapCard key={msg.id} title={msg.title} content={msg.content} bulletPoints={msg.bulletPoints} />
        );
      case 'clue':
        return (
          <div key={msg.id} className={`${styles.message} ${styles.clue} ${msg.isNew ? styles.clueNew : ''}`}>
            <span className={`${styles.time} font-mono`}>{msg.timestamp}</span>
            <div className={styles.content}>{msg.content}</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.feedContainer}>
      <div className={styles.feed}>
        {messages.map(renderMessage)}
        <div ref={feedEndRef} />
      </div>
      
      <div className={styles.inputArea}>
        <div className={styles.statusLabel}>
          <span className={styles.dot}></span>
          <span className="font-mono">AI ANALYSIS READY</span>
        </div>
        <div className={styles.inputWrapper}>
          <input 
            type="text" 
            placeholder="Ask a question or present evidence..." 
            className={styles.input}
          />
          <button className={styles.sendBtn}>SEND</button>
        </div>
      </div>
    </div>
  );
};

export default InvestigationFeed;
