import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { performanceApi } from '../../services/api';
import {
    Award, BarChart3, Users, Clock, CheckCircle2, AlertCircle,
    TrendingUp, FileText, ChevronRight, Star, Target, Calendar
} from 'lucide-react';

const RATING_SCALE = {
    5: 'EXCEEDS ALL EXPECTATIONS',
    4: 'EXCEEDS SOME EXPECTATIONS',
    3: 'MEETS ALL EXPECTATIONS',
    2: 'MEETS SOME EXPECTATIONS',
    1: 'NEEDS IMPROVEMENT',
};

const STATUS_COLORS = {
    'Draft': { bg: 'var(--gray-100)', color: 'var(--gray-600)', icon: FileText },
    'Self-Appraisal Pending': { bg: '#fef3c7', color: '#d97706', icon: Clock },
    'Manager Review Pending': { bg: '#dbeafe', color: '#2563eb', icon: Users },
    'Pending Acknowledgement': { bg: '#e0e7ff', color: '#4338ca', icon: AlertCircle },
    'Closed': { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle2 },
};

export default function PerformanceDashboard() {
    const { user, isAdmin, isManager } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [adminData, setAdminData] = useState(null);
    const [myAppraisals, setMyAppraisals] = useState([]);
    const [managerAppraisals, setManagerAppraisals] = useState([]);
    const [cycles, setCycles] = useState([]);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [cyclesRes, myRes] = await Promise.all([
                performanceApi.getCycles(),
                performanceApi.getAppraisals({ associate_id: user?.associate_id })
            ]);
            setCycles(cyclesRes.data || []);
            setMyAppraisals(myRes.data || []);

            if (isAdmin) {
                const adminRes = await performanceApi.getAdminDashboard();
                setAdminData(adminRes.data);
            }
            if (isManager || isAdmin) {
                const mgrRes = await performanceApi.getManagerDashboard();
                setManagerAppraisals(mgrRes.data || []);
            }
        } catch (error) {
            console.error('Error loading PMS dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const config = STATUS_COLORS[status] || STATUS_COLORS['Draft'];
        const Icon = config.icon;
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.25rem 0.75rem', borderRadius: '999px',
                background: config.bg, color: config.color,
                fontSize: '0.75rem', fontWeight: 600,
            }}>
                <Icon size={12} />
                {status}
            </span>
        );
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    const activeCycle = cycles.find(c => c.status === 'Active');

    return (
        <div style={{ maxWidth: '1200px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: 'var(--radius-xl)',
                        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}>
                        <Award size={24} color="white" />
                    </div>
                    <div>
                        <h1 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.125rem' }}>
                            Performance Management
                        </h1>
                        <p className="text-muted small">
                            {activeCycle ? `Active Cycle: ${activeCycle.name} (${activeCycle.year})` : 'Manage appraisals and performance reviews'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Admin Overview Cards */}
            {isAdmin && adminData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {Object.entries(STATUS_COLORS).map(([status, config]) => {
                        const count = adminData.status_breakdown?.[status] || 0;
                        const Icon = config.icon;
                        return (
                            <div key={status} onClick={() => navigate('/performance/appraisals')}
                                style={{
                                    padding: '1.25rem', borderRadius: 'var(--radius-xl)',
                                    background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
                                    border: '1px solid rgba(255,255,255,0.6)',
                                    boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: 'var(--radius-lg)',
                                        background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Icon size={18} color={config.color} />
                                    </div>
                                    <span style={{ fontSize: '1.75rem', fontWeight: 700, color: config.color }}>{count}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-600)' }}>{status}</div>
                            </div>
                        );
                    })}
                    <div onClick={() => navigate('/performance/appraisals')}
                        style={{
                            padding: '1.25rem', borderRadius: 'var(--radius-xl)',
                            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', cursor: 'pointer',
                            transition: 'all 0.3s ease', color: 'white'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            {adminData.total || 0}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>Total Appraisals</div>
                    </div>
                </div>
            )}

            {/* My Appraisal Card */}
            {myAppraisals.length > 0 && (
                <div className="card shadow-md border-0" style={{ marginBottom: '2rem' }}>
                    <div className="card-header bg-white border-bottom-0 pt-4 px-4">
                        <h5 className="card-title mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Star size={18} className="text-primary" /> My Appraisals
                        </h5>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr style={{ background: 'var(--gray-50)' }}>
                                        <th className="px-4 py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Cycle</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Status</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Self Score</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Manager Score</th>
                                        <th className="px-4 py-3 text-end small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myAppraisals.map(a => (
                                        <tr key={a.appraisal_id} className="hover-row">
                                            <td className="px-4 py-3 fw-bold text-dark">{a.cycle_id}</td>
                                            <td className="py-3"><StatusBadge status={a.status} /></td>
                                            <td className="py-3 fw-bold">{a.overall_self_score || '-'}</td>
                                            <td className="py-3 fw-bold">{a.overall_mgr_score || '-'}</td>
                                            <td className="px-4 py-3 text-end">
                                                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 ms-auto"
                                                    onClick={() => navigate(`/performance/appraisals/${a.appraisal_id}`)}>
                                                    {a.status === 'Self-Appraisal Pending' ? 'Fill Appraisal' : 'View'}
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Manager: Direct Reportees */}
            {(isManager || isAdmin) && managerAppraisals.length > 0 && (
                <div className="card shadow-md border-0" style={{ marginBottom: '2rem' }}>
                    <div className="card-header bg-white border-bottom-0 pt-4 px-4">
                        <h5 className="card-title mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={18} className="text-primary" /> Team Appraisals
                        </h5>
                        <p className="text-muted small">Direct reportees requiring your attention</p>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr style={{ background: 'var(--gray-50)' }}>
                                        <th className="px-4 py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Associate</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Designation</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Status</th>
                                        <th className="py-3 small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Self Score</th>
                                        <th className="px-4 py-3 text-end small text-uppercase fw-bold text-muted" style={{ letterSpacing: '0.05em' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {managerAppraisals.map(a => (
                                        <tr key={a.appraisal_id} className="hover-row">
                                            <td className="px-4 py-3 fw-bold text-dark">{a.associate_name}</td>
                                            <td className="py-3 text-muted">{a.designation}</td>
                                            <td className="py-3"><StatusBadge status={a.status} /></td>
                                            <td className="py-3 fw-bold">{a.overall_self_score || '-'}</td>
                                            <td className="px-4 py-3 text-end">
                                                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 ms-auto"
                                                    onClick={() => navigate(`/performance/appraisals/${a.appraisal_id}`)}>
                                                    {a.status === 'Manager Review Pending' ? 'Review' : 'View'}
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            {isAdmin && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    <div onClick={() => navigate('/performance/templates')}
                        className="card shadow-sm border-0" style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    >
                        <div className="card-body p-4 d-flex align-items-center gap-3">
                            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Target size={24} color="#2563eb" />
                            </div>
                            <div>
                                <div className="fw-bold">Goal Templates</div>
                                <div className="text-muted small">Create and manage appraisal templates</div>
                            </div>
                            <ChevronRight size={16} className="ms-auto text-muted" />
                        </div>
                    </div>
                    <div onClick={() => navigate('/performance/cycles')}
                        className="card shadow-sm border-0" style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    >
                        <div className="card-body p-4 d-flex align-items-center gap-3">
                            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Calendar size={24} color="#d97706" />
                            </div>
                            <div>
                                <div className="fw-bold">Appraisal Cycles</div>
                                <div className="text-muted small">Initiate and manage review cycles</div>
                            </div>
                            <ChevronRight size={16} className="ms-auto text-muted" />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover { background: var(--gray-50); }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
