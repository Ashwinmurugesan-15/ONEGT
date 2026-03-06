import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, BarChart3, Home, Trophy, Target, Zap, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AssessmentResult() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [result, setResult] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem(`result_${id}`);
        if (stored) {
            setResult(JSON.parse(stored));
        } else {
            navigate('/assessment');
        }
    }, [id, navigate]);

    if (!result) return null;

    const scorePercentage = Math.round(result.score);
    const isPerfect = scorePercentage === 100;
    const isExcellent = scorePercentage >= 80;
    const isGood = scorePercentage >= 60;

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
            {/* Header / Hero */}
            <div className="text-center mb-12">
                <div className="inline-flex p-8 bg-amber-50 rounded-[2.5rem] shadow-xl shadow-amber-100 mb-8 transform hover:scale-110 transition-transform cursor-pointer">
                    {isPerfect ? (
                        <Trophy className="text-amber-500" size={80} />
                    ) : isExcellent ? (
                        <Award className="text-amber-600" size={80} />
                    ) : (
                        <Target className="text-amber-700" size={80} />
                    )}
                </div>
                <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
                    {isPerfect ? 'Perfect Score!' : isExcellent ? 'Excellent Effort!' : isGood ? 'Great Job!' : 'Nice Attempt!'}
                </h1>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                    {isPerfect
                        ? 'You demonstrated absolute mastery of the material. Outstanding!'
                        : 'Your results have been recorded and sent to your examiner for final review.'}
                </p>
            </div>

            {/* Main Score Card */}
            <div className="bg-white rounded-[3rem] shadow-2xl border border-amber-50 p-12 text-center mb-10 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-amber-500" />
                <div className="text-[10rem] font-black leading-none text-gray-900 mb-6 tracking-tighter">
                    {scorePercentage}<span className="text-amber-500">%</span>
                </div>
                <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                    <div className="bg-green-50 rounded-3xl p-6 border border-green-100">
                        <div className="text-4xl font-extrabold text-green-600 mb-1">{result.correct_count}</div>
                        <div className="text-xs font-bold text-green-800 uppercase tracking-widest">Correct</div>
                    </div>
                    <div className="bg-red-50 rounded-3xl p-6 border border-red-100">
                        <div className="text-4xl font-extrabold text-red-600 mb-1">{result.total_questions - result.correct_count}</div>
                        <div className="text-xs font-bold text-red-800 uppercase tracking-widest">Incorrect</div>
                    </div>
                    <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
                        <div className="text-4xl font-extrabold text-blue-600 mb-1">{Math.round(result.analytics?.time_taken_seconds || 0)}s</div>
                        <div className="text-xs font-bold text-blue-800 uppercase tracking-widest">Duration</div>
                    </div>
                </div>
            </div>

            {/* Detailed Analytics */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Target className="text-amber-600" size={28} />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(result.analytics?.accuracy_percent || 0)}%</div>
                    <div className="text-sm text-gray-500">Topic Accuracy</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Zap className="text-amber-600" size={28} />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(result.analytics?.avg_time_per_question_seconds || 0)}s</div>
                    <div className="text-sm text-gray-500">Pace / Question</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="text-amber-600" size={28} />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{result.total_questions}</div>
                    <div className="text-sm text-gray-500">Scope Examined</div>
                </div>
            </div>

            {/* Action Area */}
            <div className="flex justify-center flex-col sm:flex-row gap-4">
                <button
                    onClick={() => navigate('/assessment')}
                    className="px-10 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg hover:transform hover:translate-y-[-2px]"
                >
                    <Home size={20} />
                    Return Dashboard
                </button>
                {user?.role === 'candidate' && (
                    <button
                        onClick={() => navigate('/assessment/learning')}
                        className="px-10 py-4 bg-white border-2 border-amber-500 text-amber-700 font-bold rounded-2xl hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Zap size={20} />
                        Boost Learning
                    </button>
                )}
            </div>
        </div>
    );
}
