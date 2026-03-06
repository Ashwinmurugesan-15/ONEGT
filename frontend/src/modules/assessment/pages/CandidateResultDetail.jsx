import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, Calendar, Award, AlertCircle, Download, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CandidateResultDetail() {
    const { assessmentId, userId } = useParams();
    const navigate = useNavigate();
    const { getAuthHeader } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeAttempt, setActiveAttempt] = useState(0);
    const [showAllDetails, setShowAllDetails] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                // Using the admin endpoint for result details
                const res = await fetch(`/api/assessment/admin/users/${userId}/results`, {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const jsonData = await res.json();
                    // In this integrated version, we might need to filter the user's results for this specific assessment
                    const resultsForThisAssessment = jsonData.results.filter(r => (r.assessment_id || r.id) === assessmentId);

                    // We need the detailed question-by-question data too. 
                    // If the backend doesn't provide it in the summary, we might need another endpoint.
                    // For now, let's assume the basic results are available.
                    setData({
                        user: jsonData.user,
                        results: resultsForThisAssessment,
                        assessment: resultsForThisAssessment[0] // Simplified for now
                    });

                    if (resultsForThisAssessment.length > 0) {
                        setActiveAttempt(resultsForThisAssessment.length - 1);
                    }
                } else {
                    throw new Error('Failed to fetch details');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [assessmentId, userId]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium">Loading candidate performance data...</p>
            </div>
        );
    }

    if (!data || !data.results || data.results.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <ShieldAlert size={64} className="text-red-400 mb-6" />
                <h2 className="text-2xl font-black text-slate-900 mb-2">Result Data Unavailable</h2>
                <p className="text-slate-500 max-w-xs mx-auto mb-8">This candidate may not have completed the assessment, or data is inaccessible.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const currentResult = data.results[activeAttempt];
    const percentage = currentResult.percentage;

    const downloadCSV = () => {
        const headers = ["Question", "Candidate Answer", "Correct Answer", "Status", "Points"];
        const rows = (currentResult.detailed || []).map(item => [
            `"${item.question_text || 'Q'}"`,
            item.submitted || 'N/A',
            item.correct || 'N/A',
            item.is_correct ? 'Correct' : 'Incorrect',
            item.points_awarded
        ]);

        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Result_${data.user.name}_Atpt_${activeAttempt + 1}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Nav */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Results
                </button>
                <div className="flex items-center gap-3">
                    {data.results.length > 1 && (
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {data.results.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveAttempt(idx)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeAttempt === idx ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Attempt {idx + 1}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={downloadCSV}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                        <Download size={18} />
                        Export Data
                    </button>
                </div>
            </div>

            {/* Candidate Info */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center gap-8 animate-slide-in">
                <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-center border-8 shadow-inner ${percentage >= 80 ? 'border-emerald-50 text-emerald-600 bg-emerald-50/30' :
                    percentage >= 50 ? 'border-blue-50 text-blue-600 bg-blue-50/30' : 'border-red-50 text-red-600 bg-red-50/30'
                    }`}>
                    <div className="text-4xl font-black">{percentage}%</div>
                    <div className="text-[10px] uppercase font-black tracking-tighter opacity-60">Success Rate</div>
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-black text-slate-900 leading-tight mb-1">{data.user.name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-6 text-slate-400 font-bold text-sm">
                        <span className="flex items-center gap-2"><Award size={18} className="text-blue-500" /> {currentResult.assessment_title}</span>
                        <span className="flex items-center gap-2"><Calendar size={18} className="text-slate-300" /> {new Date(currentResult.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-center px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-2xl font-black text-slate-900">{currentResult.score}/{currentResult.max_score}</div>
                        <div className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Raw Score</div>
                    </div>
                </div>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600"><Clock size={24} /></div>
                    <div>
                        <div className="text-lg font-bold text-slate-900">
                            {currentResult.analytics?.time_taken_seconds
                                ? `${Math.floor(currentResult.analytics.time_taken_seconds / 60)}:${(currentResult.analytics.time_taken_seconds % 60).toString().padStart(2, '0')}m`
                                : '0:00m'}
                        </div>
                        <div className="text-xs text-slate-400 font-bold">Total Duration</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600"><Award size={24} /></div>
                    <div>
                        <div className="text-lg font-bold text-slate-900">Level 4</div>
                        <div className="text-xs text-slate-400 font-bold">Rank Tier</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600"><AlertCircle size={24} /></div>
                    <div>
                        <div className="text-lg font-bold text-slate-900">{currentResult.tab_switch_count || 0}</div>
                        <div className="text-xs text-slate-400 font-bold">Proctor Violations</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
                    <div>
                        <div className="text-lg font-bold text-slate-900">{percentage >= 70 ? 'High' : percentage >= 40 ? 'Moderate' : 'Low'}</div>
                        <div className="text-xs text-slate-400 font-bold">Accuracy Level</div>
                    </div>
                </div>
            </div>

            {/* Responses Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="w-2 h-8 bg-blue-600 rounded-full" />
                        Response Breakdown
                    </h2>
                    <button
                        onClick={() => setShowAllDetails(!showAllDetails)}
                        className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-all"
                    >
                        {showAllDetails ? 'Collapse All' : 'Expand All'}
                    </button>
                </div>

                {!currentResult.detailed ? (
                    <div className="bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200">
                        <p className="text-slate-500 font-bold mb-1">Detailed question data is currently archived.</p>
                        <p className="text-slate-400 text-sm">Please contact support for session recovery.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {currentResult.detailed.map((item, idx) => (
                            <div key={idx} className={`bg-white rounded-2xl border-2 transition-all ${item.is_correct ? 'border-emerald-50 hover:border-emerald-100' : 'border-rose-50 hover:border-rose-100'} shadow-sm p-6 overflow-hidden`}>
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${item.is_correct ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-bold text-slate-900 text-lg leading-snug">{item.question_text || 'Question Content Unavailable'}</p>
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {item.is_correct ? '+1.0' : '0.0'}
                                            </span>
                                        </div>

                                        {(showAllDetails || !item.is_correct) && (
                                            <div className="grid md:grid-cols-2 gap-4 mt-6 animate-slide-in">
                                                <div className={`p-4 rounded-xl border-2 ${item.is_correct ? 'bg-emerald-50/30 border-emerald-50' : 'bg-rose-50/30 border-rose-50'}`}>
                                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Candidate Selection</div>
                                                    <div className={`font-bold ${item.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>{item.submitted || 'No Answer'}</div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-blue-50/30 border-2 border-blue-50">
                                                    <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-2">Validated Key</div>
                                                    <div className="font-bold text-blue-700">{item.correct}</div>
                                                </div>
                                            </div>
                                        )}
                                        {item.explanation && (showAllDetails || !item.is_correct) && (
                                            <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm text-slate-600 border border-slate-100 italic">
                                                <span className="font-black text-slate-400 not-italic mr-1 uppercase text-[10px]">Context:</span>
                                                {item.explanation}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
