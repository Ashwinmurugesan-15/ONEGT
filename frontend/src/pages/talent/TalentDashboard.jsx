import { GraduationCap, Briefcase, UserPlus, CalendarDays, BookOpen, Award, Target, TrendingUp } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import { useAuth } from '../../contexts/AuthContext';

function TalentDashboard() {
    const { user } = useAuth();

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Talent Management Dashboard</h1>
                    <p className="page-subtitle">Welcome back, {user.name}. Manage recruitment, development, and performance.</p>
                </div>
                <div style={{
                    padding: '0.5rem 1rem',
                    background: '#8b5cf615',
                    borderRadius: '0.5rem',
                    border: '1px solid #8b5cf630',
                    color: '#8b5cf6',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <GraduationCap size={18} />
                    Talent Module Active
                </div>
            </div>

            {/* Stats Overview */}
            <div className="stats-grid mb-8">
                <StatCard
                    icon={Briefcase}
                    value="-"
                    label="Active Job Postings"
                    color="purple"
                    subtitle="Recruitment pipeline coming soon"
                />
                <StatCard
                    icon={UserPlus}
                    value="-"
                    label="New Candidates"
                    color="blue"
                    subtitle="Candidate tracking under development"
                />
                <StatCard
                    icon={Award}
                    value="-"
                    label="Training Completion"
                    color="green"
                    subtitle="Skills management coming soon"
                />
                <StatCard
                    icon={Target}
                    value="-"
                    label="Goal Achievement"
                    color="orange"
                    subtitle="Performance tracking under development"
                />
            </div>

            {/* Content Grid */}
            <div className="card" style={{ padding: '3rem', textAlign: 'center', background: 'var(--gray-50)', border: '1px dashed var(--gray-300)' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: '#8b5cf615',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <GraduationCap size={40} color="#8b5cf6" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '1rem' }}>
                        Talent Management Module Under Development
                    </h2>
                    <p style={{ color: 'var(--gray-600)', lineHeight: '1.6', marginBottom: '2rem' }}>
                        We are building a comprehensive suite of tools to help you manage your organization's human capital.
                        The upcoming Talent Management module will feature:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserPlus size={16} color="#8b5cf6" /> Recruitment
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Full-cycle candidate tracking from job posting to onboarding.</div>
                        </div>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen size={16} color="#8b5cf6" /> Skill Dev
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Manage training programs and employee skill progression.</div>
                        </div>
                        <div style={{ padding: '1rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--gray-100)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Target size={16} color="#8b5cf6" /> Performance
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Define goals, track KPIs, and conduct performance reviews.</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem' }}>
                        <button className="btn btn-primary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}>
                            View Roadmap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TalentDashboard;
