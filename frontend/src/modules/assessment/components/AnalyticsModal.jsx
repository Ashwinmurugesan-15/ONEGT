import { useState, useEffect } from 'react';
import { XCircle, BarChart3, Users, Clock, ArrowUpRight, Loader2, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsModal({ isOpen, onClose, resourceId, resourceTitle }) {
    const { getAuthHeader } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && resourceId) {
            const fetchAnalytics = async () => {
                setLoading(true);
                try {
                    const res = await fetch(`/api/assessment/learning/${resourceId}/analytics`, {
                        headers: getAuthHeader()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setAnalytics(data);
                    }
                } catch (error) {
                    console.error('Error fetching resource analytics:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchAnalytics();
        }
    }, [isOpen, resourceId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl relative animate-slide-in overflow-hidden">
                {/* Header */}
                <div className="px-10 py-8 border-b border-slate-50 flex items-start justify-between bg-slate-50/30">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-2">
                            <BarChart3 size={16} />
                            Engagement Analytics
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight">
                            {resourceTitle}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
                    >
                        <XCircle size={28} />
                    </button>
                </div>

                <div className="p-10">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
                            <p className="text-slate-400 font-medium tracking-tight">Compiling engagement data...</p>
                        </div>
                    ) : !analytics || !analytics.views || analytics.views.length === 0 ? (
                        <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <Users size={48} className="text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No engagement yet.</p>
                            <p className="text-slate-400 text-sm">Be the first to share this resource with candidates!</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                                    <div className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1">Total Views</div>
                                    <div className="text-3xl font-black text-blue-900">{analytics.total_views}</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl">
                                    <div className="text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">Unique Users</div>
                                    <div className="text-3xl font-black text-emerald-900">{analytics.unique_users}</div>
                                </div>
                            </div>

                            {/* Viewer List */}
                            <div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    Recent Activity
                                    <span className="h-px bg-slate-100 flex-1" />
                                </h3>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {analytics.views.map((v, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs shadow-sm">
                                                    {v.user_name?.split(' ').map(n => n[0]).join('') || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{v.user_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium">{v.user_email}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-500">{new Date(v.viewed_at).toLocaleDateString()}</div>
                                                <div className="text-[10px] text-slate-300 font-medium">{new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
