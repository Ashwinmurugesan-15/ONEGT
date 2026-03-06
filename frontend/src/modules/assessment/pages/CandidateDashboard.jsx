import { useState, useEffect } from 'react';
import { Calendar, Clock, Trophy, TrendingUp, ChevronDown, ClipboardList, ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';

/* ── Exact colour map from the reference ────────────────── */
const COLOR_MAP = {
    blue: { bg: '#cce7ff', fg: '#0066b3' },
    green: { bg: '#ecfdf5', fg: '#059669' },
    yellow: { bg: '#fffbeb', fg: '#d97706' },
    red: { bg: '#fef2f2', fg: '#dc2626' },
    orange: { bg: '#fff7ed', fg: '#ea580c' },
    purple: { bg: '#f5f3ff', fg: '#7c3aed' },
};

export default function CandidateDashboard() {
    const { user } = useAuth();
    const { myAssessments, myResults, learningResources, loading } = useAssessment();
    const [showAllUpcoming, setShowAllUpcoming] = useState(false);
    const [showAllResults, setShowAllResults] = useState(false);

    const upcoming = myAssessments.filter(a => a.status === 'upcoming');
    const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 4);
    const visibleResults = showAllResults ? myResults : myResults.slice(0, 4);

    const formatDate = (d) => {
        if (!d) return 'Not scheduled';
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const upcomingCount = upcoming.length;
    const avgScore = myResults.length > 0
        ? Math.round(myResults.reduce((acc, r) => acc + (r.score / r.max_score) * 100, 0) / myResults.length)
        : 0;

    const STAT_CARDS = [
        { icon: ClipboardList, value: String(upcomingCount), label: 'Upcoming Tests', color: 'orange' },
        { icon: Trophy, value: String(myResults.length), label: 'Completed', color: 'green' },
        { icon: TrendingUp, value: `${avgScore}%`, label: 'Avg Score', color: 'blue' },
    ];

    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, border: '4px solid #0066b3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b' }}>Loading dashboard…</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '2rem' }}>
            {/* ── Header ── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Candidate Dashboard</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Welcome back, {user?.name}. View your assessments and track your progress.</p>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {STAT_CARDS.map((card, idx) => {
                    const Icon = card.icon;
                    const clr = COLOR_MAP[card.color] || COLOR_MAP.blue;
                    return (
                        <div key={`candidate-stat-${idx}-${card.label.replace(/\s+/g, '-')}`} className="stat-card-hover" style={{
                            background: 'white', borderRadius: '1.25rem', padding: '1.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255,255,255,0.8)', transition: 'all 250ms',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '1rem', background: clr.bg, color: clr.fg,
                            }}>
                                <Icon size={24} />
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', lineHeight: 1, marginBottom: '0.25rem' }}>{card.value}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{card.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Upcoming Assessments ── */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Upcoming Assessments</h2>
            {upcomingCount === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '1.25rem', marginBottom: '2rem' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 20, background: '#f59e0b15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Calendar size={40} color="#f59e0b" />
                    </div>
                    <p style={{ color: '#64748b' }}>No upcoming assessments</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    {visibleUpcoming.map((a, idx) => (
                        <div key={`candidate-upcoming-${a.id || a.assessment_id || idx}`} className="stat-card-hover" style={{
                            background: 'white', borderRadius: '1.25rem', padding: '1.25rem 1.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.8)',
                            display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'all 250ms', flexWrap: 'wrap'
                        }}>
                            <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: COLOR_MAP.orange.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ClipboardList size={24} color={COLOR_MAP.orange.fg} />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{a.title}</div>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{formatDate(a.scheduled_for)}</span>
                                    {a.duration_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{a.duration_minutes} min</span>}
                                </div>
                            </div>
                            <Link to={`/assessment/test/${a.id || a.assessment_id}`} style={{
                                padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                                color: 'white', fontWeight: 600, fontSize: '0.875rem', borderRadius: '0.75rem',
                                textDecoration: 'none', boxShadow: '0 4px 15px rgba(0,102,179,0.35)', textAlign: 'center', whiteSpace: 'nowrap'
                            }}>
                                Start Test
                            </Link>
                        </div>
                    ))}
                    {upcomingCount > 4 && (
                        <div style={{ textAlign: 'center', paddingTop: 8 }}>
                            <button onClick={() => setShowAllUpcoming(!showAllUpcoming)} style={{
                                padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #cbd5e1',
                                color: '#475569', fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.75rem',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                {showAllUpcoming ? 'Show Less' : 'View More'}
                                <ChevronDown size={16} style={{ transform: showAllUpcoming ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Past Results ── */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Recent Results</h2>
            {myResults.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '1.25rem' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 20, background: '#ecfdf515', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Trophy size={40} color="#059669" />
                    </div>
                    <p style={{ color: '#64748b' }}>No completed assessments yet</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {visibleResults.map((r, idx) => (
                        <div key={`candidate-result-${r.assessment_id || idx}`} className="stat-card-hover" style={{
                            background: 'white', borderRadius: '1.25rem', padding: '1.25rem 1.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.8)',
                            display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'all 250ms', flexWrap: 'wrap'
                        }}>
                            <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: COLOR_MAP.green.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trophy size={24} color={COLOR_MAP.green.fg} />
                            </div>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{r.assessment_title}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatDate(r.graded_at)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0066b3' }}>{Math.round((r.score / r.max_score) * 100)}%</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.score}/{r.max_score} points</div>
                            </div>
                        </div>
                    ))}
                    {myResults.length > 4 && (
                        <div style={{ textAlign: 'center', paddingTop: 8 }}>
                            <button onClick={() => setShowAllResults(!showAllResults)} style={{
                                padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #cbd5e1',
                                color: '#475569', fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.75rem',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                {showAllResults ? 'Show Less' : 'View More'}
                                <ChevronDown size={16} style={{ transform: showAllResults ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Learning Material ── */}
            <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Learning Material</h2>
                {learningResources.length > 3 && (
                    <Link to="/assessment/learning" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0066b3', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        View All <ArrowRight size={16} />
                    </Link>
                )}
            </div>

            {learningResources.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '1.25rem' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 20, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <BookOpen size={40} color="#6366f1" />
                    </div>
                    <p style={{ color: '#64748b' }}>Check back soon for learning materials</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {learningResources.slice(0, 3).map((resource, idx) => (
                        <div key={`lerning-res-${resource.id || idx}`} className="stat-card-hover" style={{
                            background: 'white', borderRadius: '1.25rem', padding: '1.25rem',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.8)',
                            transition: 'all 250ms'
                        }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <BookOpen size={24} color="#7c3aed" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.title}</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{resource.description}</p>
                                </div>
                            </div>
                            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Calendar size={12} /> {new Date(resource.created_at || Date.now()).toLocaleDateString()}
                                </span>
                                <Link to="/assessment/learning" style={{
                                    fontSize: '0.75rem', fontWeight: 700, color: '#0066b3', textDecoration: 'none',
                                    padding: '4px 12px', background: '#f0f9ff', borderRadius: '6px'
                                }}>
                                    Study Now
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .stat-card-hover:hover {
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important;
                    transform: translateY(-4px);
                }
            `}</style>
        </div>
    );
}
