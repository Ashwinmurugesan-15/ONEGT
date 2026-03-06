import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { performanceApi } from '../../services/api';
import {
    Award, Star, Send, CheckCircle2, MessageSquare, ChevronDown,
    ChevronRight, User, Building, Calendar, ArrowLeft, Lock,
    Plus, Save, AlertCircle, FileText
} from 'lucide-react';

const RATING_SCALE = [
    { score: 5, label: 'EXCEEDS ALL EXPECTATIONS', color: '#16a34a', bg: '#dcfce7' },
    { score: 4, label: 'EXCEEDS SOME EXPECTATIONS', color: '#2563eb', bg: '#dbeafe' },
    { score: 3, label: 'MEETS ALL EXPECTATIONS', color: '#d97706', bg: '#fef3c7' },
    { score: 2, label: 'MEETS SOME EXPECTATIONS', color: '#ea580c', bg: '#ffedd5' },
    { score: 1, label: 'NEEDS IMPROVEMENT', color: '#dc2626', bg: '#fef2f2' },
];

const STATUS_MAP = {
    'Draft': { color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    'Self-Appraisal Pending': { color: '#d97706', bg: '#fef3c7' },
    'Manager Review Pending': { color: '#2563eb', bg: '#dbeafe' },
    'Pending Acknowledgement': { color: '#4338ca', bg: '#e0e7ff' },
    'Closed': { color: '#16a34a', bg: '#dcfce7' },
};

export default function AppraisalDocument() {
    const { appraisalId } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [appraisal, setAppraisal] = useState(null);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selfComments, setSelfComments] = useState('');
    const [mgrFeedback, setMgrFeedback] = useState('');
    const [discussionOutcome, setDiscussionOutcome] = useState('');
    const [expandedCats, setExpandedCats] = useState({});
    const [showAddGoal, setShowAddGoal] = useState(null);
    const [newGoal, setNewGoal] = useState({ category_id: '', description: '', expected_outcome: '', target_metric: '' });

    useEffect(() => { loadAppraisal(); }, [appraisalId]);

    const loadAppraisal = async () => {
        try {
            const res = await performanceApi.getAppraisal(appraisalId);
            const data = res.data;
            setAppraisal(data);
            setGoals(data.goals || []);
            setSelfComments(data.self_comments || '');
            setMgrFeedback(data.mgr_feedback || '');
            setDiscussionOutcome(data.discussion_outcome || '');
            // Expand all categories by default
            const cats = {};
            (data.goals || []).forEach(g => { cats[g.category_id] = true; });
            setExpandedCats(cats);
        } catch (error) {
            showToast('Error loading appraisal', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isSelfStage = appraisal?.status === 'Self-Appraisal Pending';
    const isManagerStage = appraisal?.status === 'Manager Review Pending';
    const isAckStage = appraisal?.status === 'Pending Acknowledgement';
    const isClosed = appraisal?.status === 'Closed';
    const isMyAppraisal = appraisal?.associate_id === user?.associate_id;
    const isMyReportee = appraisal?.manager_id === user?.associate_id;
    const canSelfEdit = isSelfStage && isMyAppraisal;
    const canManagerEdit = isManagerStage && (isMyReportee || isAdmin);
    const canAcknowledge = isAckStage && isMyAppraisal;

    // Group goals by category
    const categories = {};
    goals.forEach(g => {
        const cid = g.category_id;
        if (!categories[cid]) {
            categories[cid] = {
                category_id: cid,
                name: g.category_name || cid,
                weight: parseFloat(g.category_weight) || 0,
                goals: []
            };
        }
        categories[cid].goals.push(g);
    });

    const updateGoalField = (goalId, field, value) => {
        setGoals(prev => prev.map(g => g.goal_id === goalId ? { ...g, [field]: value } : g));
    };

    const getRatingConfig = (score) => {
        return RATING_SCALE.find(r => r.score === parseInt(score)) || null;
    };

    // Calculate weighted score
    const calcOverall = (field) => {
        let total = 0, weightSum = 0;
        Object.values(categories).forEach(cat => {
            const scores = cat.goals.map(g => parseInt(g[field])).filter(s => !isNaN(s) && s > 0);
            if (scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                total += avg * (cat.weight / 100);
                weightSum += cat.weight;
            }
        });
        return weightSum > 0 ? total.toFixed(2) : null;
    };

    const handleSelfSubmit = async () => {
        const missing = goals.filter(g => !g.self_score || !g.self_comments);
        if (missing.length > 0) {
            showToast('Please fill in scores and comments for all goals before submitting', 'error');
            return;
        }
        if (!confirm('Submit your self-appraisal? You will not be able to edit after submission.')) return;
        setSaving(true);
        try {
            await performanceApi.selfSubmit(appraisalId, {
                goals: goals.map(g => ({ goal_id: g.goal_id, self_score: parseInt(g.self_score), self_comments: g.self_comments })),
                self_comments: selfComments
            });
            showToast('Self-appraisal submitted successfully!', 'success');
            loadAppraisal();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error submitting', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleManagerSubmit = async () => {
        const missing = goals.filter(g => !g.mgr_score);
        if (missing.length > 0) {
            showToast('Please fill in scores for all goals', 'error');
            return;
        }
        if (!confirm('Submit your manager review? The associate will be notified.')) return;
        setSaving(true);
        try {
            await performanceApi.managerSubmit(appraisalId, {
                goals: goals.map(g => ({ goal_id: g.goal_id, mgr_score: parseInt(g.mgr_score), mgr_comments: g.mgr_comments || '' })),
                mgr_feedback: mgrFeedback
            });
            showToast('Manager review submitted!', 'success');
            loadAppraisal();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error submitting review', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAcknowledge = async () => {
        if (!confirm('Acknowledge and close this appraisal? This action is final.')) return;
        setSaving(true);
        try {
            await performanceApi.acknowledge(appraisalId, { discussion_outcome: discussionOutcome });
            showToast('Appraisal acknowledged and closed!', 'success');
            loadAppraisal();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error acknowledging', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newGoal.description) return;
        setSaving(true);
        try {
            await performanceApi.addCustomGoal(appraisalId, { ...newGoal, category_id: showAddGoal });
            showToast('Custom goal added!', 'success');
            setShowAddGoal(null);
            setNewGoal({ category_id: '', description: '', expected_outcome: '', target_metric: '' });
            loadAppraisal();
        } catch (error) {
            showToast(error.response?.data?.detail || 'Error adding goal', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Rating Selector Component
    const RatingSelector = ({ value, onChange, disabled = false }) => (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {RATING_SCALE.map(r => (
                <button key={r.score} type="button" disabled={disabled}
                    onClick={() => onChange(r.score)}
                    style={{
                        padding: '0.375rem 0.75rem', borderRadius: '8px',
                        border: parseInt(value) === r.score ? `2px solid ${r.color}` : '2px solid transparent',
                        background: parseInt(value) === r.score ? r.bg : 'var(--gray-50)',
                        color: parseInt(value) === r.score ? r.color : 'var(--gray-500)',
                        fontSize: '0.7rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.2s ease', opacity: disabled ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', gap: '0.375rem'
                    }}
                    title={r.label}
                >
                    <Star size={12} fill={parseInt(value) === r.score ? r.color : 'none'} />
                    {r.score}
                </button>
            ))}
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    if (!appraisal) return (
        <div className="text-center p-5">
            <AlertCircle size={48} className="text-danger mb-3" />
            <h6>Appraisal not found</h6>
            <button className="btn btn-primary mt-2" onClick={() => navigate('/performance/appraisals')}>
                <ArrowLeft size={16} /> Back to List
            </button>
        </div>
    );

    const selfOverall = calcOverall('self_score');
    const mgrOverall = calcOverall('mgr_score');
    const statusConfig = STATUS_MAP[appraisal.status] || STATUS_MAP['Draft'];

    return (
        <div style={{ maxWidth: '1100px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Back Button */}
            <button className="btn btn-link text-decoration-none p-0 mb-3 d-flex align-items-center gap-1 text-muted"
                onClick={() => navigate('/performance/appraisals')}>
                <ArrowLeft size={16} /> Back to Appraisals
            </button>

            {/* Employee Header Card */}
            <div className="card shadow-md border-0 mb-4">
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <div style={{
                                width: '56px', height: '56px', borderRadius: 'var(--radius-xl)',
                                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', color: 'white',
                                fontSize: '1.25rem', fontWeight: 700
                            }}>
                                {(appraisal.associate_name || '?')[0]}
                            </div>
                            <div>
                                <h4 className="fw-bold mb-1" style={{ fontSize: '1.25rem' }}>{appraisal.associate_name}</h4>
                                <div className="d-flex gap-3 flex-wrap">
                                    <span className="text-muted small d-flex align-items-center gap-1"><User size={12} /> {appraisal.designation}</span>
                                    <span className="text-muted small d-flex align-items-center gap-1"><Building size={12} /> {appraisal.department}</span>
                                    <span className="text-muted small d-flex align-items-center gap-1"><Calendar size={12} /> {appraisal.cycle_id}</span>
                                </div>
                            </div>
                        </div>
                        <div className="d-flex flex-column align-items-end gap-2">
                            <span style={{
                                padding: '0.375rem 1rem', borderRadius: '999px',
                                background: statusConfig.bg, color: statusConfig.color,
                                fontSize: '0.8rem', fontWeight: 600
                            }}>
                                {isClosed && <Lock size={12} style={{ marginRight: '4px' }} />}
                                {appraisal.status}
                            </span>
                            {appraisal.manager_name && (
                                <span className="text-muted small">Manager: <strong>{appraisal.manager_name}</strong></span>
                            )}
                        </div>
                    </div>

                    {/* Score Summary */}
                    {(selfOverall || appraisal.overall_self_score || mgrOverall || appraisal.overall_mgr_score) && (
                        <div className="d-flex gap-3 mt-4 flex-wrap">
                            <div style={{ padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-lg)', background: '#f0f9ff', border: '1px solid #bfdbfe', flex: 1, minWidth: '180px' }}>
                                <div className="small fw-bold text-muted mb-1">Self Assessment</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>
                                    {selfOverall || appraisal.overall_self_score || '-'}
                                    <span className="text-muted fw-normal" style={{ fontSize: '0.85rem' }}> / 5.00</span>
                                </div>
                                {selfOverall && getRatingConfig(Math.round(parseFloat(selfOverall))) && (
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: getRatingConfig(Math.round(parseFloat(selfOverall))).color, marginTop: '0.25rem' }}>
                                        {getRatingConfig(Math.round(parseFloat(selfOverall))).label}
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-lg)', background: '#f0fdf4', border: '1px solid #bbf7d0', flex: 1, minWidth: '180px' }}>
                                <div className="small fw-bold text-muted mb-1">Manager Assessment</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                                    {mgrOverall || appraisal.overall_mgr_score || '-'}
                                    <span className="text-muted fw-normal" style={{ fontSize: '0.85rem' }}> / 5.00</span>
                                </div>
                                {mgrOverall && getRatingConfig(Math.round(parseFloat(mgrOverall))) && (
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: getRatingConfig(Math.round(parseFloat(mgrOverall))).color, marginTop: '0.25rem' }}>
                                        {getRatingConfig(Math.round(parseFloat(mgrOverall))).label}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Categories & Goals */}
            {Object.values(categories).map(cat => (
                <div key={cat.category_id} className="card shadow-sm border-0 mb-3">
                    {/* Category Header */}
                    <div className="card-header bg-white p-3 d-flex justify-content-between align-items-center"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedCats(prev => ({ ...prev, [cat.category_id]: !prev[cat.category_id] }))}
                    >
                        <div className="d-flex align-items-center gap-2">
                            {expandedCats[cat.category_id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <h6 className="mb-0 fw-bold">{cat.name}</h6>
                            <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-1 fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Weight: {cat.weight}%
                            </span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            {canSelfEdit && (
                                <button className="btn btn-sm btn-light d-flex align-items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); setShowAddGoal(cat.category_id); }}>
                                    <Plus size={12} /> Add Goal
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Goals */}
                    {expandedCats[cat.category_id] && (
                        <div className="card-body p-0">
                            {cat.goals.map((goal, idx) => (
                                <div key={goal.goal_id || idx} style={{
                                    padding: '1.25rem 1.5rem',
                                    borderBottom: idx < cat.goals.length - 1 ? '1px solid var(--gray-100)' : 'none',
                                    background: goal.is_custom === 'True' || goal.is_custom === true ? '#fefce8' : 'white'
                                }}>
                                    {/* Goal header & badges */}
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.95rem' }}>{goal.description}</div>
                                            {goal.expected_outcome && <div className="text-muted small">Expected: {goal.expected_outcome}</div>}
                                            {goal.target_metric && <div className="text-primary small fw-semibold">Target: {goal.target_metric}</div>}
                                        </div>
                                        <div className="d-flex gap-2">
                                            {(goal.is_custom === 'True' || goal.is_custom === true) && (
                                                <span style={{ fontSize: '0.65rem', padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                                                    Added by Employee
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Self-Appraisal Section */}
                                    <div className="row g-3 mt-2">
                                        <div className="col-md-6">
                                            <div style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                                                <div className="small fw-bold text-muted mb-2 d-flex align-items-center gap-1">
                                                    <User size={12} /> Self Assessment
                                                </div>
                                                <div className="mb-2">
                                                    <label className="small fw-bold text-dark d-block mb-1">Rating</label>
                                                    <RatingSelector value={goal.self_score} onChange={v => updateGoalField(goal.goal_id, 'self_score', v)} disabled={!canSelfEdit} />
                                                    {goal.self_score && (
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: getRatingConfig(parseInt(goal.self_score))?.color, marginTop: '0.375rem' }}>
                                                            {getRatingConfig(parseInt(goal.self_score))?.label}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="small fw-bold text-dark d-block mb-1">Comments {canSelfEdit && <span className="text-danger">*</span>}</label>
                                                    <textarea className="form-control form-control-sm" rows="2" value={goal.self_comments || ''} onChange={e => updateGoalField(goal.goal_id, 'self_comments', e.target.value)} disabled={!canSelfEdit} placeholder="Describe your achievements and outcomes..." style={{ fontSize: '0.85rem' }} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manager Review Section */}
                                        <div className="col-md-6">
                                            <div style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: '#f0fdf4', border: '1px solid #bbf7d0', opacity: isSelfStage ? 0.5 : 1 }}>
                                                <div className="small fw-bold text-muted mb-2 d-flex align-items-center gap-1">
                                                    <Award size={12} /> Manager Assessment
                                                </div>
                                                <div className="mb-2">
                                                    <label className="small fw-bold text-dark d-block mb-1">Rating</label>
                                                    <RatingSelector value={goal.mgr_score} onChange={v => updateGoalField(goal.goal_id, 'mgr_score', v)} disabled={!canManagerEdit} />
                                                    {goal.mgr_score && (
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: getRatingConfig(parseInt(goal.mgr_score))?.color, marginTop: '0.375rem' }}>
                                                            {getRatingConfig(parseInt(goal.mgr_score))?.label}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="small fw-bold text-dark d-block mb-1">Comments</label>
                                                    <textarea className="form-control form-control-sm" rows="2" value={goal.mgr_comments || ''} onChange={e => updateGoalField(goal.goal_id, 'mgr_comments', e.target.value)} disabled={!canManagerEdit} placeholder="Manager's observations..." style={{ fontSize: '0.85rem' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add Goal Inline */}
                            {showAddGoal === cat.category_id && (
                                <div style={{ padding: '1rem 1.5rem', borderTop: '2px dashed var(--primary-200)', background: '#faf5ff' }}>
                                    <div className="small fw-bold text-primary mb-2">Add Custom Goal</div>
                                    <div className="row g-2">
                                        <div className="col-md-5">
                                            <input type="text" className="form-control form-control-sm" placeholder="Goal Description *" value={newGoal.description} onChange={e => setNewGoal({ ...newGoal, description: e.target.value })} />
                                        </div>
                                        <div className="col-md-3">
                                            <input type="text" className="form-control form-control-sm" placeholder="Expected Outcome" value={newGoal.expected_outcome} onChange={e => setNewGoal({ ...newGoal, expected_outcome: e.target.value })} />
                                        </div>
                                        <div className="col-md-2">
                                            <input type="text" className="form-control form-control-sm" placeholder="Target" value={newGoal.target_metric} onChange={e => setNewGoal({ ...newGoal, target_metric: e.target.value })} />
                                        </div>
                                        <div className="col-md-2 d-flex gap-1">
                                            <button className="btn btn-primary btn-sm flex-fill" onClick={handleAddGoal} disabled={saving || !newGoal.description}>
                                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <Plus size={14} />}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddGoal(null)}>
                                                <ChevronRight size={14} style={{ transform: 'rotate(45deg)' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* General Comments Section */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-4">
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                        <MessageSquare size={16} className="text-primary" /> General Comments
                    </h6>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark">Self-Assessment Summary</label>
                            <textarea className="form-control" rows="4" value={selfComments} onChange={e => setSelfComments(e.target.value)} disabled={!canSelfEdit} placeholder="Overall self-assessment comments..." />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark">Manager Feedback</label>
                            <textarea className="form-control" rows="4" value={mgrFeedback} onChange={e => setMgrFeedback(e.target.value)} disabled={!canManagerEdit} placeholder="Overall manager feedback..." />
                        </div>
                    </div>

                    {/* Post-Appraisal Discussion */}
                    {(isAckStage || isClosed) && (
                        <div className="mt-4">
                            <label className="form-label small fw-bold text-dark">Post-Appraisal Discussion Outcome</label>
                            <textarea className="form-control" rows="3" value={discussionOutcome} onChange={e => setDiscussionOutcome(e.target.value)} disabled={!canAcknowledge} placeholder="Summary of 1:1 feedback session, agreed actions, development plan..." />
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            {(canSelfEdit || canManagerEdit || canAcknowledge) && (
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body p-4 d-flex justify-content-end gap-3">
                        {canSelfEdit && (
                            <button className="btn btn-primary btn-lg d-flex align-items-center gap-2 shadow-sm px-4" onClick={handleSelfSubmit} disabled={saving}>
                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <Send size={18} />}
                                Submit Self-Appraisal
                            </button>
                        )}
                        {canManagerEdit && (
                            <button className="btn btn-success btn-lg d-flex align-items-center gap-2 shadow-sm px-4" onClick={handleManagerSubmit} disabled={saving}>
                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <CheckCircle2 size={18} />}
                                Submit Manager Review
                            </button>
                        )}
                        {canAcknowledge && (
                            <button className="btn btn-primary btn-lg d-flex align-items-center gap-2 shadow-sm px-4" onClick={handleAcknowledge} disabled={saving} style={{ background: '#6d28d9', borderColor: '#6d28d9' }}>
                                {saving ? <span className="spinner-border spinner-border-sm"></span> : <CheckCircle2 size={18} />}
                                Acknowledge & Close
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Rating Legend */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <div className="small fw-bold text-muted mb-2">Rating Scale</div>
                    <div className="d-flex gap-3 flex-wrap">
                        {RATING_SCALE.map(r => (
                            <div key={r.score} className="d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: r.bg, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem' }}>{r.score}</div>
                                <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

// Rating Selector Sub-component
const RATING_SCALE_DATA = [
    { score: 5, label: 'EXCEEDS ALL EXPECTATIONS', color: '#16a34a', bg: '#dcfce7' },
    { score: 4, label: 'EXCEEDS SOME EXPECTATIONS', color: '#2563eb', bg: '#dbeafe' },
    { score: 3, label: 'MEETS ALL EXPECTATIONS', color: '#d97706', bg: '#fef3c7' },
    { score: 2, label: 'MEETS SOME EXPECTATIONS', color: '#ea580c', bg: '#ffedd5' },
    { score: 1, label: 'NEEDS IMPROVEMENT', color: '#dc2626', bg: '#fef2f2' },
];

function RatingSelector({ value, onChange, disabled = false }) {
    return (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {RATING_SCALE_DATA.map(r => (
                <button key={r.score} type="button" disabled={disabled}
                    onClick={() => onChange(r.score)}
                    style={{
                        padding: '0.375rem 0.75rem', borderRadius: '8px',
                        border: parseInt(value) === r.score ? `2px solid ${r.color}` : '2px solid transparent',
                        background: parseInt(value) === r.score ? r.bg : 'var(--gray-50)',
                        color: parseInt(value) === r.score ? r.color : 'var(--gray-500)',
                        fontSize: '0.7rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.2s ease', opacity: disabled ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', gap: '0.375rem'
                    }}
                    title={r.label}
                >
                    <Star size={12} fill={parseInt(value) === r.score ? r.color : 'none'} />
                    {r.score}
                </button>
            ))}
        </div>
    );
}
