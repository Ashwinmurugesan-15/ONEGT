import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users, Clock, BookOpen, TrendingUp, Award, Download, XCircle, Loader2, ChevronLeft, Calendar, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export default function AssessmentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, getAuthHeader } = useAuth();
    const { gradeAssessment } = useAssessment(); // We'll use this context for state if needed

    const [assessment, setAssessment] = useState(null);
    const [results, setResults] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [allCandidates, setAllCandidates] = useState([]);
    const [selectedCandidates, setSelectedCandidates] = useState([]);
    const [updatingAssignments, setUpdatingAssignments] = useState(false);

    const fetchDetails = async () => {
        try {
            const res = await fetch(`/api/assessment/examiner/assessment/${id}`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const d = await res.json();
                setAssessment(d.assessment);
                setResults(d.results || []);
                setAssignedUsers(d.assigned_users || []);
                setSelectedCandidates(d.assessment.assigned_to || []);
            } else {
                setError('Failed to load assessment. You might not have permission or it doesn\'t exist.');
            }
        } catch (e) {
            console.error(e);
            setError('An unexpected error occurred while fetching details.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCandidates = async () => {
        try {
            const res = await fetch('/api/assessment/examiner/candidates', {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const d = await res.json();
                setAllCandidates(d.candidates || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchDetails();
        fetchCandidates();
    }, [id]);

    const handleUpdateAssignments = async () => {
        setUpdatingAssignments(true);
        try {
            const res = await fetch(`/api/assessment/examiner/assessment/${id}`, {
                method: 'PATCH',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: selectedCandidates })
            });
            if (!res.ok) throw new Error('Failed to update assignments');
            const data = await res.json();
            setAssessment(data.assessment);
            setShowAssignModal(false);
        } catch (error) {
            alert(error.message);
        } finally {
            setUpdatingAssignments(false);
        }
    };

    const handleGrantRetake = async (candidateId, candidateName) => {
        if (!confirm(`Grant retake permission to "${candidateName}"?`)) return;
        try {
            const res = await fetch(`/api/assessment/examiner/assessment/${id}/retake`, {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidate_id: candidateId, examiner_id: user.id })
            });
            if (res.ok) {
                alert('Retake granted successfully');
                fetchDetails();
            } else {
                const d = await res.json();
                throw new Error(d.error || 'Failed to grant retake');
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const handleExportXLSX = () => {
        if (results.length === 0) {
            alert('No results to export');
            return;
        }

        const data = results.map(r => ({
            'Candidate Name': r.user_name,
            'Email': r.user_email,
            'Score': r.score,
            'Max Score': r.max_score,
            'Percentage': `${Math.round((r.score / r.max_score) * 100)}%`,
            'Time Taken (Sec)': r.time_taken_seconds || 0,
            'Tab Switches': r.tab_switch_count || 0,
            'Termination Reason': r.termination_reason || 'N/A',
            'Submitted At': new Date(r.graded_at).toLocaleString()
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, `${assessment.title.replace(/\s+/g, '_')}_Report.xlsx`);
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-amber-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium tracking-wide">Loading details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <XCircle size={40} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h2>
                <p className="text-gray-500 max-w-md mx-auto mb-8 font-medium">{error}</p>
                <button
                    onClick={() => navigate('/assessment')}
                    className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all shadow-xl"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (!assessment) return null;

    const stats = {
        avgScore: results.length > 0
            ? Math.round(results.reduce((a, b) => a + (b.score / b.max_score) * 100, 0) / results.length)
            : 0
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <button onClick={() => navigate('/assessment')} className="flex items-center gap-1 text-amber-600 font-bold mb-4 hover:gap-2 transition-all">
                        <ChevronLeft size={20} />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">{assessment.title}</h1>
                    <p className="text-gray-500 mt-2 max-w-2xl">{assessment.description || 'No description provided.'}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-amber-600 text-amber-600 rounded-xl font-bold hover:bg-amber-50 transition-all shadow-sm"
                    >
                        <Users size={20} />
                        Assign Candidates
                    </button>
                    <button
                        onClick={handleExportXLSX}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
                    >
                        <Download size={20} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: BookOpen, label: 'Questions', value: assessment.questions?.length || 0, color: 'bg-amber-50 text-amber-600' },
                    { icon: Users, label: 'Assigned', value: assessment.assigned_to?.length || 0, color: 'bg-blue-50 text-blue-600' },
                    { icon: Award, label: 'Completed', value: results.length, color: 'bg-green-50 text-green-600' },
                    { icon: TrendingUp, label: 'Avg Score', value: `${stats.avgScore}%`, color: 'bg-purple-50 text-purple-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
                            <s.icon size={20} />
                        </div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</div>
                        <div className="text-2xl font-black text-gray-900">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-xl font-black text-gray-900">Submission History</h2>
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 uppercase tracking-tighter">
                        {results.length} Records Found
                    </span>
                </div>

                {results.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock size={40} className="text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-bold">No submissions received yet for this assessment.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/30 text-xs font-black text-gray-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Candidate</th>
                                    <th className="px-8 py-5">Performance</th>
                                    <th className="px-8 py-5">Submitted At</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {results.map((r) => {
                                    const pct = Math.round((r.score / r.max_score) * 100);
                                    return (
                                        <tr key={`${r.user_id}_${r.graded_at}`} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="font-black text-gray-900">{r.user_name || 'Anonymous User'}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{r.user_email || r.user_id}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`text-xl font-black ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                                                        }`}>{pct}%</div>
                                                    <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                        {r.score} / {r.max_score}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-gray-500 font-medium">
                                                {new Date(r.graded_at).toLocaleDateString()} at {new Date(r.graded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2 text-right">
                                                    <Link
                                                        to={`/assessment/examiner/result/${id}/${r.user_id}`}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1"
                                                    >
                                                        <FileText size={14} />
                                                        View Details
                                                    </Link>
                                                    <button
                                                        onClick={() => handleGrantRetake(r.user_id, r.user_name)}
                                                        disabled={r.retake_granted}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${r.retake_granted
                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                            }`}
                                                    >
                                                        {r.retake_granted ? 'Retake Granted' : 'Allow Retake'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pending Assignments */}
            {assignedUsers.filter(au => !results.some(r => r.user_id === au.id)).length > 0 && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-xl font-black text-gray-900 leading-none">Pending Completion</h2>
                        <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-black text-amber-600 uppercase tracking-widest">
                            {assignedUsers.filter(au => !results.some(r => r.user_id === au.id)).length} Pending
                        </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assignedUsers.filter(au => !results.some(r => r.user_id === au.id)).map(u => (
                            <div key={u.id} className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-amber-200 transition-all">
                                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-black text-gray-400 group-hover:text-amber-500 transition-colors">
                                    {u.name.charAt(0)}
                                </div>
                                <div className="ml-4 overflow-hidden">
                                    <p className="text-sm font-black text-gray-900 truncate">{u.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold truncate tracking-tight">{u.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Questions Section */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden mt-8">
                <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-xl font-black text-gray-900">Assessment Questions</h2>
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 uppercase tracking-tighter">
                        {assessment.questions?.length || 0} Total
                    </span>
                </div>
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {(assessment.questions || []).map((q, idx) => (
                        <div key={idx} className="p-8 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 leading-snug mb-4">{String(q.text || q.question || 'Untitled Question')}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(q.options || []).map((opt, oIdx) => {
                                            const optionText = typeof opt === 'object' ? opt.text : opt;
                                            const optionId = typeof opt === 'object' ? opt.id : String.fromCharCode(65 + oIdx);
                                            const isCorrect = typeof opt === 'object'
                                                ? optionId === q.correct_option_id
                                                : opt === q.correctAnswer;

                                            return (
                                                <div
                                                    key={oIdx}
                                                    className={`p-3 rounded-xl border text-sm font-medium ${isCorrect
                                                        ? 'bg-green-50 border-green-200 text-green-700'
                                                        : 'bg-white border-gray-100 text-gray-500'
                                                        }`}
                                                >
                                                    <span className="inline-block w-6 text-gray-400 font-bold">{String(optionId)}.</span>
                                                    {String(optionText)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <Users size={28} className="text-amber-600" />
                                Manage Assignments
                            </h2>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-900">
                                <XCircle size={32} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto mb-10 pr-2 custom-scrollbar">
                            {allCandidates.map(c => (
                                <label key={c.id} className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedCandidates.includes(c.id)
                                    ? 'border-amber-500 bg-amber-50 shadow-sm'
                                    : 'border-white bg-gray-50 hover:border-amber-200'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCandidates.includes(c.id)}
                                        onChange={() => setSelectedCandidates(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                        className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-black text-gray-900">{c.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{c.email}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setShowAssignModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateAssignments}
                                disabled={updatingAssignments}
                                className="flex-1 py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                            >
                                {updatingAssignments ? 'Saving...' : 'Save Assignments'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
