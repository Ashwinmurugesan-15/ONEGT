import { useState, useEffect } from 'react';
import { BookOpen, UserCheck, TrendingUp, Calendar, ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
    amber: { bg: '#fffbeb', fg: '#d97706' }
};

export default function ExaminerDashboard() {
    const { user } = useAuth();
    const { assessments, loading, refresh } = useAssessment();
    const [stats, setStats] = useState({ totalAssessments: 0, totalCandidates: 0, avgScore: 0 });
    const [showAll, setShowAll] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (assessments && assessments.length > 0) {
            const totalCandidates = assessments.reduce((acc, a) => acc + (a.assigned_to?.length || 0), 0);
            setStats({
                totalAssessments: assessments.length,
                totalCandidates,
                avgScore: 78 // Placeholder until backend analytics integration
            });
        }
    }, [assessments]);

    const formatDate = (d) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const visibleAssessments = showAll ? assessments : assessments.slice(0, 4);

    const STAT_CARDS = [
        { icon: BookOpen, value: String(stats.totalAssessments), label: 'Total Assessments', color: 'orange' },
        { icon: UserCheck, value: String(stats.totalCandidates), label: 'Active Candidates', color: 'blue' },
        { icon: TrendingUp, value: `${Math.round(stats.avgScore)}%`, label: 'Average Performance', color: 'green' },
    ];

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '2rem' }}>
            {/* ── Page Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Examiner Dashboard</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Welcome back, {user?.name}. Manage your assessments and review candidates.</p>
                </div>
                <button
                    onClick={() => navigate('/assessment/create')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem',
                        background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                        color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none',
                        borderRadius: '0.75rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,102,179,0.35)',
                    }}
                >
                    <Plus size={18} /> New Assessment
                </button>
            </div>

            {/* ── Stats Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {STAT_CARDS.map((card, idx) => {
                    const Icon = card.icon;
                    const clr = COLOR_MAP[card.color] || COLOR_MAP.blue;
                    return (
                        <div key={`examiner-stat-${idx}-${card.label.replace(/\s+/g, '-')}`} className="stat-card-hover" style={{
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

            {/* ── Assessment List ── */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Your Assessments</h2>

            {assessments.length === 0 && !loading ? (
                <div style={{
                    padding: '3rem', textAlign: 'center', background: '#f8fafc',
                    border: '1px dashed #cbd5e1', borderRadius: '1.25rem',
                }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: 20, background: '#f59e0b15',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                    }}>
                        <BookOpen size={40} color="#f59e0b" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>No Assessments Yet</h3>
                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Wait for an admin to create assessments, or create your first evaluation to start testing candidates.</p>
                    <button
                        onClick={() => navigate('/assessment/create')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem',
                            background: 'white', border: '1px solid #cbd5e1', color: '#0066b3',
                            fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.75rem', cursor: 'pointer',
                        }}
                    >
                        <Plus size={18} /> Get Started
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {visibleAssessments.map((a, idx) => (
                        <Link key={`examiner-assessment-${a.id || idx}`} to={`/assessment/manage/${a.id || a.assessment_id}`} style={{ textDecoration: 'none' }}>
                            <div className="stat-card-hover" style={{
                                background: 'white', borderRadius: '1.25rem', padding: '1.25rem 1.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.8)',
                                display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'all 250ms',
                            }}>
                                <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={24} color="#94a3b8" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{a.title}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{formatDate(a.created_at)}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={12} />{a.questions?.length || 0} questions</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserCheck size={12} />{a.assigned_to?.length || 0} candidates</span>
                                    </div>
                                </div>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ChevronRight size={18} color="#94a3b8" />
                                </div>
                            </div>
                        </Link>
                    ))}
                    {assessments.length > 4 && (
                        <div style={{ textAlign: 'center', paddingTop: 8 }}>
                            <button onClick={() => setShowAll(!showAll)} style={{
                                padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #cbd5e1',
                                color: '#475569', fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.75rem',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                {showAll ? 'Show Less' : 'View More'}
                                <ChevronDown size={16} style={{ transition: 'transform 200ms', transform: showAll ? 'rotate(180deg)' : 'none' }} />
                            </button>
                        </div>
                    )}
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
