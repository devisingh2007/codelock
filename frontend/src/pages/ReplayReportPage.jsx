import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReplayReport } from '../api/gameApi';
import { FileText, Clock, AlertTriangle, Crosshair, Award } from 'lucide-react';
import styles from './ReplayReportPage.module.css';

const ReplayReportPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      const data = await getReplayReport(roomCode);
      setReport(data);
    };
    fetchReport();
  }, [roomCode]);

  if (!report) {
    return (
      <div className="app-container items-center justify-center">
        <div className="font-mono text-accent blink text-xl">GENERATING REPORT...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageLayout}>
      <main className={styles.mainContent}>
        <div className={styles.reportContainer}>
          
          <div className={styles.header}>
            <div className="flex items-center gap-2 mb-2 text-accent">
              <FileText size={28} />
              <h1 className="font-serif text-3xl">Case Debrief</h1>
            </div>
            <p className="font-mono text-muted text-sm">ARCHIVE #{roomCode}</p>
          </div>

          <div className={styles.gridContainer}>
            
            {/* Timeline Section */}
            <div className={styles.sectionCard}>
              <h3 className="font-mono text-accent mb-4 flex items-center gap-2">
                <Clock size={16} /> TIMELINE OF TRUTH
              </h3>
              <div className={styles.timelineList}>
                {report.timeline.map((event, idx) => (
                  <div key={idx} className={styles.timelineItem}>
                    <div className={styles.timeLineMarker}></div>
                    <div className={styles.timeText}>{event.time}</div>
                    <div className={styles.eventText}>{event.event}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voting Breakdown */}
            <div className={styles.sectionCard}>
              <h3 className="font-mono text-accent mb-4 flex items-center gap-2">
                <Crosshair size={16} /> VOTE BREAKDOWN
              </h3>
              <div className={styles.voteList}>
                {report.votes.map((v, idx) => (
                  <div key={idx} className={styles.voteRow}>
                    <span className={styles.voterName}>{v.player}</span>
                    <span className="text-muted font-mono text-xs">voted for</span>
                    <span className={styles.votedTarget}>{v.votedFor}</span>
                    {v.correct ? (
                      <span className={styles.correctTag}>CORRECT</span>
                    ) : (
                      <span className={styles.incorrectTag}>INCORRECT</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 font-mono text-muted text-sm">
                TEAM ACCURACY: <span className="text-accent text-lg">{report.accuracy}</span>
              </div>
            </div>

            {/* Clue Impact */}
            <div className={styles.sectionCard}>
              <h3 className="font-mono text-accent mb-4 flex items-center gap-2">
                <FileText size={16} /> CLUE IMPACT
              </h3>
              <div className={styles.clueImpactColumns}>
                <div>
                  <h4 className={styles.subHeader}>MATTERED</h4>
                  <ul className={styles.bulletList}>
                    {report.clueImpact.mattered.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className={styles.subHeader}>IGNORED</h4>
                  <ul className={styles.bulletList}>
                    {report.clueImpact.ignored.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            {/* Lies & Contradictions */}
            <div className={styles.sectionCard}>
              <h3 className="font-mono text-danger mb-4 flex items-center gap-2">
                <AlertTriangle size={16} /> IDENTIFIED LIES
              </h3>
              <div className={styles.liesList}>
                {report.lies.map((l, idx) => (
                  <div key={idx} className={styles.lieItem}>
                    <span className={styles.lieChar}>{l.character}:</span>
                    <span className={styles.lieText}>"{l.lie}"</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges / Accolades */}
            <div className={`${styles.sectionCard} ${styles.badgesCard}`}>
              <h3 className="font-mono text-accent mb-4 flex items-center gap-2">
                <Award size={16} /> TEAM ACCOLADES
              </h3>
              <div className={styles.badgeGrid}>
                {report.badges.map((b) => (
                  <div key={b.id} className={styles.badgeItem}>
                    <div className={styles.badgeIcon}></div>
                    <div className={styles.badgeTitle}>{b.name}</div>
                    <div className={styles.badgeHolder}>{b.holder}</div>
                    <div className={styles.badgeDesc}>{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className={styles.footerActions}>
            <button className={styles.primaryBtn} onClick={() => navigate('/')}>
              RETURN TO HQ
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ReplayReportPage;
