import { ClipboardCheck, FileText, UserCheck, BarChart3, TrendingUp, FileQuestion, UserPlus, Clock } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import { useAuth } from '../../contexts/AuthContext';

function AssessmentDashboard() {
    const { user } = useAuth();

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Assessment Portal Dashboard</h1>
                    <p className="page-subtitle">Welcome back, {user.name}. Track and manage participant assessments.</p>
                </div>
                <div style={{
                    padding: '0.5rem 1rem',
                    background: '#f59e0b15',
                    borderRadius: '0.5rem',
                    border: '1px solid #f59e0be30',
                    color: '#f59e0b',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <ClipboardCheck size={18} />
                    Assessment Module Active
                </div>
            </div>

            {/* Stats Overview */}
            <div className="stats-grid mb-8">
                <StatCard
                    icon={FileText}
                    value="-"
                    label="Active Assessments"
                    color="orange"
                    subtitle="System integration pending"
                />
                <StatCard
                    icon={UserCheck}
                    value="-"
                    label="Total Participants"
                    color="blue"
                    subtitle="User sync coming soon"
                />
                <StatCard
                    icon={BarChart3}
                    value="-"
                    label="Average Score"
                    color="green"
                    subtitle="Analytics engine development"
                />
                <StatCard
                    icon={Clock}
                    value="-"
                    label="Avg. Completion Time"
                    color="purple"
                    subtitle="Metrics tracking pending"
                />
            </div>

            {/* Content Grid */}
            <div className="card" style={{ padding: '3rem', textAlign: 'center', background: 'var(--gray-50)', border: '1px dashed var(--gray-300)' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: '#f59e0b15',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <ClipboardCheck size={40} color="#f59e0b" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '1rem' }}>
                        Assessment Portal Under Development
                    </h2>
                    <p style={{ color: 'var(--gray-600)', lineHeight: '1.6', marginBottom: '2rem' }}>
                        A powerful platform for creating, managing, and evaluating technical and professional assessments.
                        The upcoming Assessment Portal will include:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileQuestion size={16} color="#f59e0b" /> Question Bank
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Rich library of categorized questions for rapid test generation.</div>
                        </div>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={16} color="#f59e0b" /> Auto-Eval
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Automated scoring and detailed performance analytics for participants.</div>
                        </div>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={16} color="#f59e0b" /> Timed Exams
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Proctored and timed examination environment with anti-cheat tools.</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem' }}>
                        <button className="btn btn-secondary" style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>
                            Read Documentation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AssessmentDashboard;
