import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';
import styles from './FAQPage.module.css';

const faqs = [
  {
    q: 'Does the game require an internet connection?',
    a: 'The backend server needs to run locally (Node.js + MongoDB). The AI mystery generator requires Ollama to be running on the host machine. All real-time communication happens over Socket.IO within your local network or a deployed server.',
  },
  {
    q: 'How many players can join one room?',
    a: 'Each room supports 2 to 8 players. The host configures the maximum player count when creating the room. Rooms have a 6-character alphanumeric code for easy sharing.',
  },
  {
    q: 'What AI model does the mystery generator use?',
    a: 'By default, the system uses whatever Ollama model is configured in your .env (e.g. llama3, mistral, phi3). The mystery generator sends a structured prompt and validates the JSON response schema before accepting it.',
  },
  {
    q: 'Can I play without Ollama installed?',
    a: 'The mystery generation endpoint requires Ollama. However, the lobby, chat, evidence board, and voting systems all function independently. You can test those features without AI by triggering a mock mystery via the game state API.',
  },
  {
    q: 'How does the accusation vote work?',
    a: 'When the host opens the voting phase, every player submits one accusation naming a suspect. Votes are tallied server-side and the majority verdict is announced. The AI then reveals the true murderer, motive, and complete timeline in the debrief screen.',
  },
  {
    q: 'Is the chat history saved?',
    a: 'Yes. All lobby chat messages are persisted to MongoDB via the ChatMessage model. When a player reconnects to a room, the last 20 messages are restored automatically on socket join.',
  },
  {
    q: 'Can the host kick a player mid-game?',
    a: 'Host kick controls are available in the Lobby phase before the game starts. Once the investigation begins, player removal is not currently supported to maintain game integrity.',
  },
];

const FAQPage = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);

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
          <p className={styles.category}>❓ FIELD INQUIRIES</p>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <p className={styles.subtitle}>
            Everything you need to know before you enter the investigation room.
          </p>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`${styles.faqCard} ${open === idx ? styles.faqOpen : ''}`}
              onClick={() => setOpen(open === idx ? null : idx)}
            >
              <div className={styles.faqQuestion}>
                <div className={styles.qLeft}>
                  <HelpCircle size={18} className={styles.qIcon} />
                  <h4>{faq.q}</h4>
                </div>
                <ChevronDown size={18} className={`${styles.arrow} ${open === idx ? styles.arrowOpen : ''}`} />
              </div>

              {open === idx && (
                <div className={styles.faqAnswer}>
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={() => navigate('/create')}>
            START INVESTIGATING →
          </button>
          <button className={styles.ctaGhost} onClick={() => navigate('/how-to-play')}>
            READ THE PROTOCOL
          </button>
        </div>
      </main>
    </div>
  );
};

export default FAQPage;
