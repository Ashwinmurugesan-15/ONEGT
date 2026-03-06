import { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2, Shield, FileText, Download, XCircle, BookOpen, Loader2, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';

export default function UserManagement() {
    const navigate = useNavigate();
    const { user: currentUser, getAuthHeader } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', role: 'examiner' });
    const [showReportsModal, setShowReportsModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userResults, setUserResults] = useState([]);
    const [fetchingResults, setFetchingResults] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/assessment/admin/users', {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/assessment/admin/users/create', { // This endpoint might need to be created or matched
                method: 'POST',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setFormData({ name: '', email: '', role: 'examiner' });
                setShowCreateModal(false);
                fetchUsers();
                alert('User created successfully!');
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Failed to create user');
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!confirm(`Are you sure you want to delete "${user.name}"? This action cannot be undone.`)) return;
        try {
            const res = await fetch('/api/assessment/admin/users', {
                method: 'DELETE',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: user.id })
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleViewReports = async (user) => {
        setSelectedUser(user);
        setShowReportsModal(true);
        setFetchingResults(true);
        try {
            const res = await fetch(`/api/assessment/admin/users/${user.id}/results`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setUserResults(data.results || []);
            }
        } catch (error) {
            console.error('Error fetching user results:', error);
        } finally {
            setFetchingResults(false);
        }
    };

    const downloadCSVReport = () => {
        if (!selectedUser || userResults.length === 0) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Assessment Title,Score,Max Score,Percentage,Date\n";

        userResults.forEach(r => {
            const row = [
                `"${r.assessment_title}"`,
                r.score,
                r.max_score,
                `${r.percentage}%`,
                new Date(r.timestamp).toLocaleDateString()
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedUser.name.replace(/\s+/g, '_')}_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const candidates = filteredUsers.filter(u => u.role === 'candidate');
    const examiners = filteredUsers.filter(u => u.role === 'examiner' || u.role === 'hiring_manager');
    const admins = filteredUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (loading && users.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium">Loading user data...</p>
            </div>
        );
    }

    const cardStyle = {
        background: 'white', borderRadius: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.8)', overflow: 'hidden',
    };
    const thStyle = { padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' };
    const tdStyle = { padding: '1rem 1.5rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9' };

    const COLOR_MAP = {
        blue: { bg: '#cce7ff', fg: '#0066b3' },
        purple: { bg: '#f5f3ff', fg: '#7c3aed' },
        orange: { bg: '#fff7ed', fg: '#ea580c' },
    };

    const renderTable = (userList, roleBadge, showReports = false) => (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th style={thStyle}>Name</th><th style={thStyle}>Email</th>
                    <th style={thStyle}>Created</th><th style={thStyle}>Role</th><th style={thStyle}>Actions</th>
                </tr>
            </thead>
            <tbody>
                {userList.map(u => (
                    <tr key={u.id} style={{ transition: 'background 200ms' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{u.name}</td>
                        <td style={{ ...tdStyle, color: '#64748b' }}>{u.email}</td>
                        <td style={{ ...tdStyle, color: '#64748b' }}>{formatDate(u.created_at)}</td>
                        <td style={tdStyle}>
                            <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 600, background: roleBadge.bg, color: roleBadge.color }}>{roleBadge.label}</span>
                        </td>
                        <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {showReports && (
                                    <button onClick={() => handleViewReports(u)} style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                        background: '#f5f3ff', color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600,
                                        borderRadius: 8, border: 'none', cursor: 'pointer',
                                    }}><FileText size={14} /> Reports</button>
                                )}
                                <button onClick={() => handleDeleteUser(u)} style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                    background: '#fef2f2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600,
                                    borderRadius: 8, border: 'none', cursor: 'pointer',
                                }}><Trash2 size={14} /> Delete</button>
                            </div>
                        </td>
                    </tr>
                ))}
                {userList.length === 0 && (
                    <tr><td colSpan="5" style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No users found</td></tr>
                )}
            </tbody>
        </table>
    );

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>User Management</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Manage candidates, examiners, and administrators</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ padding: '0.625rem 1rem 0.625rem 2.25rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none' }}
                        />
                    </div>
                    <button onClick={() => setShowCreateModal(true)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem',
                        background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                        color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none',
                        borderRadius: '0.75rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,102,179,0.35)',
                    }}><UserPlus size={18} /> Create User</button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {[
                    { icon: Users, label: 'Total Candidates', value: candidates.length, color: 'blue' },
                    { icon: Shield, label: 'Total Examiners', value: examiners.length, color: 'purple' },
                    { icon: Shield, label: 'Total Admins', value: admins.length, color: 'orange' },
                ].map((s, idx) => {
                    const Icon = s.icon;
                    const clr = COLOR_MAP[s.color];
                    return (
                        <div key={`user-stat-${idx}-${s.label.replace(/\s+/g, '-')}`} style={{ ...cardStyle, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: clr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={24} style={{ color: clr.fg }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{s.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Admins */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Admins</h2>
            <div style={{ ...cardStyle, marginBottom: '2rem' }}>
                {renderTable(admins, { label: 'Admin', bg: '#fff7ed', color: '#ea580c' })}
            </div>

            {/* Examiners */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Examiners</h2>
            <div style={{ ...cardStyle, marginBottom: '2rem' }}>
                {renderTable(examiners, { label: 'Examiner', bg: '#f5f3ff', color: '#7c3aed' })}
            </div>

            {/* Candidates */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Candidates</h2>
            <div style={cardStyle}>
                {renderTable(candidates, { label: 'Candidate', bg: '#cce7ff', color: '#0066b3' }, true)}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', maxWidth: 440, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: '1.5rem' }}>Create New User</h2>
                        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Role</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {(['candidate', 'examiner', 'admin']).map(role => {
                                        const clr = role === 'candidate' ? COLOR_MAP.blue : role === 'examiner' ? COLOR_MAP.purple : COLOR_MAP.orange;
                                        return (
                                            <button key={role} type="button" onClick={() => setFormData({ ...formData, role })} style={{
                                                padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer',
                                                border: `2px solid ${formData.role === role ? clr.fg : '#e2e8f0'}`,
                                                background: formData.role === role ? clr.bg : 'white',
                                                textAlign: 'center', fontWeight: 600, fontSize: '0.8rem',
                                                color: formData.role === role ? clr.fg : '#64748b',
                                            }}>
                                                {role === 'candidate' ? <Users size={20} style={{ margin: '0 auto 4px', color: formData.role === role ? clr.fg : '#94a3b8' }} /> : <Shield size={20} style={{ margin: '0 auto 4px', color: formData.role === role ? clr.fg : '#94a3b8' }} />}
                                                {role.charAt(0).toUpperCase() + role.slice(1)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Email</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: 8 }}>
                                <button type="button" onClick={() => setShowCreateModal(false)} style={{
                                    flex: 1, padding: '0.75rem', background: 'white', border: '2px solid #e2e8f0',
                                    borderRadius: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer',
                                }}>Cancel</button>
                                <button type="submit" style={{
                                    flex: 1, padding: '0.75rem',
                                    background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                                    color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(0,102,179,0.35)',
                                }}>Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Reports Modal */}
            {showReportsModal && selectedUser && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', maxWidth: 800, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FileText size={20} color="#7c3aed" /> Candidate Reports: {selectedUser.name}
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setShowReportsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><XCircle size={24} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem' }}>
                            {fetchingResults ? (
                                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                    <div style={{ width: 48, height: 48, border: '4px solid #0066b3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                                    <p style={{ color: '#64748b' }}>Fetching results...</p>
                                </div>
                            ) : userResults.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 0', background: '#f8fafc', borderRadius: '1rem', border: '2px dashed #e2e8f0' }}>
                                    <BookOpen size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px', display: 'block' }} />
                                    <p style={{ color: '#64748b', fontWeight: 500 }}>No assessment results found for this candidate.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                        {[
                                            { label: 'Assessments Taken', value: userResults.length, bg: '#f5f3ff', border: '#e9d5ff', color: '#7c3aed' },
                                            { label: 'Average Score', value: `${Math.round(userResults.reduce((a, r) => a + r.percentage, 0) / userResults.length)}%`, bg: '#cce7ff', border: '#93c5fd', color: '#0066b3' },
                                            { label: 'Highest Score', value: `${Math.max(...userResults.map(r => r.percentage))}%`, bg: '#ecfdf5', border: '#a7f3d0', color: '#059669' },
                                        ].map(s => (
                                            <div key={s.label} style={{ background: s.bg, padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${s.border}` }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.color, marginBottom: 4 }}>{s.label}</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ ...cardStyle }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Assessment</th><th style={thStyle}>Score</th>
                                                    <th style={thStyle}>Status</th><th style={thStyle}>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userResults.map((r, idx) => {
                                                    const pct = r.percentage;
                                                    return (
                                                        <tr key={idx}>
                                                            <td style={tdStyle}>
                                                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.assessment_title}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Attempt {r.attempt_number || 1}</div>
                                                            </td>
                                                            <td style={{ ...tdStyle, color: '#64748b' }}>{r.score}/{r.max_score}</td>
                                                            <td style={tdStyle}>
                                                                <span style={{
                                                                    padding: '4px 10px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700,
                                                                    background: pct >= 70 ? '#ecfdf5' : pct >= 40 ? '#cce7ff' : '#fef2f2',
                                                                    color: pct >= 70 ? '#059669' : pct >= 40 ? '#0066b3' : '#dc2626',
                                                                }}>{pct}%</span>
                                                            </td>
                                                            <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '0.8rem' }}>{new Date(r.timestamp).toLocaleDateString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={() => setShowReportsModal(false)} style={{
                                flex: 1, padding: '0.75rem', background: 'white', border: '2px solid #e2e8f0',
                                borderRadius: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer',
                            }}>Close</button>
                            <button onClick={downloadCSVReport} disabled={userResults.length === 0} style={{
                                flex: 1, padding: '0.75rem',
                                background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                                color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(0,102,179,0.35)', opacity: userResults.length === 0 ? 0.5 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}><Download size={18} /> Download Full History</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    );
}
