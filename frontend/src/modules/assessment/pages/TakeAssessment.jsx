import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight, Clock, Flag, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';

export default function TakeAssessment() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, getAuthHeader } = useAuth();
    const { gradeAssessment } = useAssessment();

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState({});
    const [startTime, setStartTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Proctoring State
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [alreadyAttempted, setAlreadyAttempted] = useState(false);

    const submittingRef = useRef(false);

    const fetchAssessment = useCallback(async () => {
        try {
            const res = await fetch(`/api/assessment/${id}`, {
                headers: getAuthHeader()
            });

            if (!res.ok) {
                const errorData = await res.json();
                if (errorData.already_attempted) {
                    setAlreadyAttempted(true);
                    setLoading(false);
                    return;
                }
                throw new Error('Failed to load assessment');
            }

            const data = await res.json();
            // Shuffle questions and limit
            let shuffled = [...data.questions].sort(() => Math.random() - 0.5);
            setQuestions(shuffled.slice(0, 100));
            setStartTime(new Date().toISOString());

            // Mark as started
            await fetch(`/api/assessment/${id}/start`, {
                method: 'POST',
                headers: getAuthHeader()
            });
        } catch (error) {
            console.error(error);
            navigate('/assessment');
        } finally {
            setLoading(false);
        }
    }, [id, getAuthHeader, navigate]);

    useEffect(() => {
        fetchAssessment();
    }, [fetchAssessment]);

    // Timer
    useEffect(() => {
        if (!loading && startTime) {
            const interval = setInterval(() => {
                const now = new Date().getTime();
                const start = new Date(startTime).getTime();
                setElapsedTime(Math.floor((now - start) / 1000));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [loading, startTime]);

    // Proctoring logic
    useEffect(() => {
        const handleViolation = (reason) => {
            if (!submittingRef.current && !alreadyAttempted && !loading) {
                setTabSwitchCount(prev => {
                    const next = prev + 1;
                    if (next >= 4) {
                        handleAutoSubmit(`Terminated: ${reason} violation limit reached`);
                    } else {
                        setShowWarning(true);
                    }
                    return next;
                });
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) handleViolation('Tab Switch');
        };

        const handleBlur = () => {
            handleViolation('Window Focus Loss');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [loading, alreadyAttempted]);

    const handleAutoSubmit = async (reason) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);

        const submission = Object.entries(answers).map(([qId, optId]) => ({
            question_id: qId,
            option_id: optId
        }));

        try {
            const result = await gradeAssessment(id, submission, {
                tab_switch_count: tabSwitchCount + 1, // Include the current violation
                termination_reason: reason,
                time_started: startTime,
                time_submitted: new Date().toISOString()
            });
            localStorage.setItem(`result_${id}`, JSON.stringify(result));
            navigate(`/assessment/test/${id}/result`);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (Object.keys(answers).length < questions.length) {
            if (!confirm('You have unanswered questions. Submit anyway?')) return;
        }

        submittingRef.current = true;
        setSubmitting(true);

        const submission = Object.entries(answers).map(([qId, optId]) => ({
            question_id: qId,
            option_id: optId
        }));

        try {
            const result = await gradeAssessment(id, submission, {
                tab_switch_count: tabSwitchCount,
                time_started: startTime,
                time_submitted: new Date().toISOString()
            });
            localStorage.setItem(`result_${id}`, JSON.stringify(result));
            navigate(`/assessment/test/${id}/result`);
        } catch (error) {
            console.error(error);
            submittingRef.current = false;
        } finally {
            setSubmitting(false);
        }
    };

    const handleOptionSelect = (qId, optId) => {
        setAnswers(prev => ({ ...prev, [qId]: optId }));
    };

    const formatTime = (s) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-amber-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium tracking-wide">Preparing your assessment...</p>
            </div>
        );
    }

    if (alreadyAttempted) {
        return (
            <div className="max-w-2xl mx-auto p-10 text-center bg-white rounded-3xl shadow-xl border border-amber-100 my-10">
                <XCircle className="text-red-500 mx-auto mb-6" size={64} />
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Assessment Already Completed</h1>
                <p className="text-gray-600 mb-8">You have already submitted this test. If you need a retake, please contact your examiner.</p>
                <button onClick={() => navigate('/assessment')} className="px-8 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Top Stats Bar */}
            <div className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 px-6 py-4 rounded-b-3xl shadow-sm mb-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
                            <Clock size={18} className="text-amber-600" />
                            <span className="font-mono font-bold text-amber-900">{formatTime(elapsedTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-900 font-bold">
                            <Flag size={18} className="text-blue-600" />
                            {Object.keys(answers).length} / {questions.length}
                        </div>
                    </div>
                    <div className="flex-1 max-w-md h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            {/* Question Palette */}
            <div className="flex flex-wrap gap-2 justify-center mb-10 overflow-x-auto pb-4">
                {questions.map((q, idx) => (
                    <button
                        key={q.id || q.question_id}
                        onClick={() => setCurrentQuestion(idx)}
                        className={`w-10 h-10 rounded-xl font-bold text-xs transition-all border-2 flex items-center justify-center ${currentQuestion === idx
                            ? 'border-amber-600 bg-amber-600 text-white shadow-md'
                            : answers[q.id || q.question_id]
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-gray-100 bg-white text-gray-400 hover:border-amber-200'
                            }`}
                    >
                        {idx + 1}
                    </button>
                ))}
            </div>

            {/* Current Question Display */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 mb-8 animate-slide-in">
                <div className="flex gap-6 mb-10">
                    <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0">
                        {currentQuestion + 1}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 leading-snug">{currentQ.text}</h2>
                </div>

                <div className="space-y-4">
                    {currentQ.options?.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => handleOptionSelect(currentQ.id || currentQ.question_id, opt.id)}
                            className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center gap-4 group ${answers[currentQ.id || currentQ.question_id] === opt.id
                                ? 'border-amber-500 bg-amber-50 shadow-sm'
                                : 'border-gray-50 bg-gray-50/50 hover:border-amber-200 hover:bg-white'
                                }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answers[currentQ.id || currentQ.question_id] === opt.id
                                ? 'border-amber-600 bg-amber-600'
                                : 'border-gray-300'
                                }`}>
                                {answers[currentQ.id || currentQ.question_id] === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <span className={`text-lg font-medium ${answers[currentQ.id || currentQ.question_id] === opt.id ? 'text-amber-900' : 'text-gray-700'
                                }`}>
                                <span className="font-bold mr-2 text-gray-400 group-hover:text-amber-400">{opt.id}.</span>
                                {opt.text}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <button
                    onClick={() => setCurrentQuestion(p => Math.max(0, p - 1))}
                    disabled={currentQuestion === 0}
                    className="flex items-center gap-2 px-6 py-3 font-bold text-gray-500 hover:text-amber-600 disabled:opacity-30"
                >
                    <ArrowLeft size={20} />
                    Previous
                </button>

                {currentQuestion === questions.length - 1 ? (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : <Flag size={20} />}
                        Final Submission
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentQuestion(p => Math.min(questions.length - 1, p + 1))}
                        className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-amber-500 text-amber-600 rounded-xl font-bold hover:bg-amber-50 transition-all shadow-sm"
                    >
                        Next
                        <ArrowRight size={20} />
                    </button>
                )}
            </div>

            {/* Warning Dialog */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-l-[10px] border-amber-500">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="text-amber-600" size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">Security Warning</h2>
                        </div>
                        <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                            Leaving the assessment window is strictly prohibited. Your activity has been logged.
                        </p>
                        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 mb-8">
                            <p className="font-bold text-amber-900 flex justify-between">
                                Warning count: <span>{tabSwitchCount} / 3</span>
                            </p>
                            <p className="text-sm text-amber-700 mt-2">
                                Your test will be <strong>terminated</strong> upon the next violation.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowWarning(false)}
                            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all"
                        >
                            Back to Test
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
