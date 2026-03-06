import { useState, useEffect } from 'react';
import { BookOpen, UserCheck, TrendingUp, Calendar, ChevronDown, ChevronRight, FileText, Plus, Trash2, BarChart3, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';

const StatCard = ({ icon: Icon, value, label, color }) => {
    const colors = {
        amber: 'bg-amber-50 text-amber-600',
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
    };
    const clr = colors[color] || colors.blue;

    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${clr}`}>
                <Icon size={24} />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
            <div className="text-sm text-gray-500 font-medium">{label}</div>
        </div>
    );
};

export default function AdminDashboard() {
    const { user } = useAuth();
    const { assessments, loading, refresh, deleteAssessment } = useAssessment();
    const [stats, setStats] = useState({
        totalAssessments: 0,
        totalCandidates: 0,
        avgScore: 0,
        avgTime: '-'
    });
    const [analytics, setAnalytics] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const navigate = useNavigate();
    const { getAuthHeader } = useAuth();

    useEffect(() => {
        if (assessments && assessments.length > 0) {
            const totalCandidates = assessments.reduce((acc, a) => acc + (a.assigned_to?.length || 0), 0);

            setStats(prev => ({
                ...prev,
                totalAssessments: assessments.length,
                totalCandidates
            }));

            const fetchAnalytics = async () => {
                try {
                    const res = await fetch('/api/assessment/admin/analytics', {
                        headers: getAuthHeader()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setAnalytics(data);

                        if (data.length > 0) {
                            const scores = data.map(a => a.admin_analytics.score_distribution.mean);
                            const times = data.map(a => a.admin_analytics.avg_total_time_seconds);

                            const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                            const avgTimeSec = times.reduce((a, b) => a + b, 0) / times.length;
                            const avgTimeMinutes = Math.round(avgTimeSec / 60);

                            setStats(prev => ({
                                ...prev,
                                avgScore,
                                avgTime: `${avgTimeMinutes}m`
                            }));
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            };
            fetchAnalytics();
        }
    }, [assessments]);

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) {
            await deleteAssessment(id);
        }
    };

    const formatDate = (d) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const visibleAssessments = showAll ? assessments : assessments.slice(0, 5);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Assessment Administration</h1>
                    <p className="text-gray-500 mt-1.5">Welcome back, <span className="text-blue-600 font-semibold">{user?.name}</span>. Overseeing all portal activity.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => navigate('/assessment/learning', { state: { openAddResource: true } })}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                        <BookOpen size={20} />
                        Add Resource
                    </button>
                    <button
                        onClick={() => navigate('/assessment/admin/users')}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                        <UserCheck size={20} />
                        Manage Users
                    </button>
                    <button
                        onClick={() => navigate('/assessment/create')}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all transform active:scale-[0.98]"
                    >
                        <Plus size={20} />
                        New Assessment
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={FileText} value={stats.totalAssessments} label="Active Assessments" color="amber" />
                <StatCard icon={UserCheck} value={stats.totalCandidates} label="Total Participants" color="blue" />
                <StatCard icon={BarChart3} value={`${stats.avgScore}%`} label="Average Score" color="green" />
                <StatCard icon={Clock} value={stats.avgTime} label="Avg. Completion Time" color="purple" />
            </div>

            {/* Assessments List */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                        Global Assessment List
                    </h2>
                    {assessments.length > 5 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            {showAll ? 'Show Less' : 'View All'}
                            <ChevronDown size={16} className={`transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                {assessments.length === 0 && !loading ? (
                    <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
                        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={40} className="text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Assessments Found</h3>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">There are no assessments in the system yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {visibleAssessments.map((a) => {
                            const id = a.id || a.assessment_id;
                            return (
                                <Link
                                    key={id}
                                    to={`/assessment/manage/${id}`}
                                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-5 group"
                                >
                                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                        <FileText size={28} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{a.title}</h4>
                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-5 mt-1">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <Calendar size={14} className="text-gray-300" />
                                                {formatDate(a.created_at)}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <BookOpen size={14} className="text-gray-300" />
                                                {a.questions?.length || 0} Questions
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <UserCheck size={14} className="text-gray-300" />
                                                {a.assigned_to?.length || 0} Candidates
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDelete(e, id)}
                                            className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 hover:text-red-600"
                                            title="Delete Assessment"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-all">
                                            <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-600" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
