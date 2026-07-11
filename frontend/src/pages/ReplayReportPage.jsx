import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import { getReplayReport } from '../api/gameApi';
import { FileText, Clock, Crosshair, CheckCircle, XCircle } from 'lucide-react';
import styles from './ReplayReportPage.module.css';

const ReplayReportPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(undefined); // undefined = loading, null = failed

  useEffect(() => {
    const fetchReport = async () => {
      const data = await getReplayReport(roomCode);
      setReport(data);
    };
    fetchReport();
  }, [roomCode]);

  if (report === undefined) {
    return (
      <div className="app-container items-center justify-center">
        <div className="font-mono text-accent blink text-xl">GENERATING REPORT...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="app-container items-center justify-center" style={{ flexDirection: 'column', gap: '16px' }}>
        <div className="font-mono text-xl" style={{ color: 'var(--danger-color, #e55)' }}>
          ⚠ Report unavailable. The game may not be complete yet.
        </div>
        <button onClick={() => navigate('/')} style={{ padding: '10px 24px', cursor: 'pointer' }}>
          Return to HQ
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageLayout}>
      <TopNavBar />
      <main className={styles.mainContent}>
        <div className={styles.reportContainer}>

          <div className={styles.header}>
            <div className="flex items-center gap-2 mb-2 text-accent">
              <FileText size={28} />
              <h1 className="font-serif text-3xl">Case Debrief</h1>
            </div>
            <p className="font-mono text-muted text-sm">ARCHIVE #{roomCode} // {report.title}</p>
          </div>

          <div className={styles.gridContainer}>

            {/* Case Summary */}
            <div className={styles.sectionCard} style={{ gridColumn: '1 / -1' }}>
              <h3 className="font-mono text-accent mb-3">CASE SUMMARY</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div><span className="font-mono text-xs text-muted">VICTIM</span><p className="font-serif text-lg">{report.victim}</p></div>
                <div><span className="font-mono text-xs text-muted">MURDERER</span><p className="font-serif text-lg" style={{ color: 'var(--danger-color, #e55)' }}>{report.murderer}</p></div>
                <div><span className="font-mono text-xs text-muted">WEAPON</span><p className="font-serif text-lg">{report.weapon}</p></div>
                <div><span className="font-mono text-xs text-muted">LOCATION</span><p className="font-serif text-lg">{report.location}</p></div>
              </div>
              {report.narrative && <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>{report.narrative}</p>}
            </div>

            {/* Timeline Section */}
            <div className={styles.sectionCard}>
              <h3 className="font-mono text-accent mb-4 flex items-center gap-2">
                <Clock size={16} /> TIMELINE OF TRUTH
              </h3>
              <div className={styles.timelineList}>
                {(report.timeline || []).map((event, idx) => (
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
                {(report.voteBreakdown || []).filter(v => v.count > 0).map((v, idx) => (
                  <div key={idx} className={styles.voteRow}>
                    <span className={styles.voterName}>{v.suspectName}</span>
                    <span className="text-muted font-mono text-xs">received {v.count} vote{v.count !== 1 ? 's' : ''}</span>
                    {v.isCorrect ? (
                      <span className={styles.correctTag}><CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />GUILTY</span>
                    ) : (
                      <span className={styles.incorrectTag}><XCircle size={12} style={{ display: 'inline', marginRight: 4 }} />INNOCENT</span>
                    )}
                  </div>
                ))}
                {(report.voteBreakdown || []).every(v => v.count === 0) && (
                  <p className="font-mono text-muted text-sm">No votes were cast in this game.</p>
                )}
              </div>
              <div className="mt-4 font-mono text-muted text-sm">
                TEAM ACCURACY: <span className="text-accent text-lg">{report.teamAccuracy}%</span>
              </div>
            </div>

            {/* Suspects List */}
            <div className={styles.sectionCard} style={{ gridColumn: '1 / -1' }}>
              <h3 className="font-mono text-accent mb-4">ALL SUSPECTS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {(report.suspects || []).map((s, idx) => (
                  <div key={idx} style={{
                    padding: '10px 14px',
                    border: `1px solid ${s.isKiller ? 'var(--danger-color, #e55)' : 'var(--border-color, #333)'}`,
                    borderRadius: '6px',
                    background: s.isKiller ? 'rgba(229,85,85,0.08)' : 'transparent'
                  }}>
                    <div className="font-serif text-sm" style={{ color: s.isKiller ? 'var(--danger-color, #e55)' : 'inherit' }}>
                      {s.name} {s.isKiller && '⚠ MURDERER'}
                    </div>
                    <div className="font-mono text-xs text-muted">{s.role}</div>
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
