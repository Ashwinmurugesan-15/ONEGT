import { useState, useEffect } from 'react';
import { Upload, Sparkles, FileText, Loader2, Wand2, ArrowLeft, Users, Calendar, Clock, Info, CheckCircle2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAssessment } from '../context/AssessmentContext';
import { jsPDF } from 'jspdf';
import { parseCSV, parseTextHeuristic } from '../lib/questionParsers';

export default function CreateAssessment() {
    const navigate = useNavigate();
    const { getAuthHeader } = useAuth();
    const { createAssessment } = useAssessment();

    const [mode, setMode] = useState('generate');
    const [loading, setLoading] = useState(false);
    const [showGuide, setShowGuide] = useState(true);
    const [candidates, setCandidates] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        prompt: '',
        file: null,
        parsedQuestions: [],
        selectedCandidates: [],
        scheduledFrom: '',
        scheduledTo: '',
        durationMinutes: 30,
        timePerQuestion: 0,
        difficulty: 'medium'
    });

    // Load candidates for assignment
    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                const res = await fetch('/api/assessment/examiner/candidates', {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setCandidates(data.candidates || []);
                }
            } catch (e) {
                console.error('Failed to load candidates', e);
            }
        };
        fetchCandidates();
    }, [getAuthHeader]);

    const toggleCandidate = (id) => {
        setFormData(prev => ({
            ...prev,
            selectedCandidates: prev.selectedCandidates.includes(id)
                ? prev.selectedCandidates.filter(c => c !== id)
                : [...prev.selectedCandidates, id]
        }));
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFormData(prev => ({ ...prev, file, parsedQuestions: [] }));

        const extension = file.name.split('.').pop().toLowerCase();

        if (['csv', 'txt'].includes(extension)) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target.result;
                let questions = [];
                if (extension === 'csv') {
                    questions = await parseCSV(content);
                } else {
                    questions = parseTextHeuristic(content);
                }
                setFormData(prev => ({ ...prev, parsedQuestions: questions }));
            };
            reader.readAsText(file);
        }
    };

    const generateExamplePDF = () => {
        try {
            const doc = new jsPDF();
            // Header
            doc.setFillColor(0, 102, 179); // OneGT Blue
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('Assessment Portal', 20, 20);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('Standard PDF Format Guide', 20, 30);
            // Content
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('How to Format Your Questions:', 20, 55);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const instructions = [
                '1. Each question must start with a number and a period (e.g., 1.)',
                '2. Options should be listed as A), B), C), D) on separate lines.',
                '3. The correct answer must be marked with "Answer: [Letter]" (e.g., Answer: A).',
                '4. Avoid using complex tables or images; use plain text layouts for best results.'
            ];
            instructions.forEach((line, i) => {
                doc.text(line, 25, 65 + (i * 8));
            });
            // Sample Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Sample Questions:', 20, 110);
            let y = 125;
            const samples = [
                { q: '1. What is the capital of France?', opts: ['A) Berlin', 'B) Paris', 'C) London', 'D) Rome'], a: 'Answer: B' },
                { q: '2. Which of these is a JavaScript framework?', opts: ['A) React', 'B) Python', 'C) Django', 'D) SQL'], a: 'Answer: A' }
            ];
            samples.forEach((item) => {
                doc.setFont('helvetica', 'bold');
                doc.text(item.q, 20, y);
                y += 8;
                doc.setFont('helvetica', 'normal');
                item.opts.forEach(opt => {
                    doc.text(opt, 30, y);
                    y += 7;
                });
                doc.setFont('helvetica', 'bold');
                doc.text(item.a, 20, y);
                y += 12;
            });
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text('Generated by OneGT Assessment Engine', 105, 285, { align: 'center' });
            doc.save('Assessment_Format_Guide.pdf');
        } catch (error) {
            console.error('PDF Generation failed:', error);
            alert('Could not generate PDF.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const dataToSend = new FormData();
        dataToSend.append('title', formData.title);
        dataToSend.append('description', formData.description);
        dataToSend.append('assignedTo', JSON.stringify(formData.selectedCandidates));
        dataToSend.append('scheduledFrom', formData.scheduledFrom);
        dataToSend.append('scheduledTo', formData.scheduledTo);
        dataToSend.append('durationMinutes', formData.durationMinutes.toString());
        dataToSend.append('timePerQuestion', formData.timePerQuestion.toString());
        dataToSend.append('difficulty', formData.difficulty);

        if (mode === 'generate') {
            dataToSend.append('prompt', formData.prompt);
        } else if (formData.parsedQuestions.length > 0) {
            dataToSend.append('questions', JSON.stringify(formData.parsedQuestions));
        } else if (formData.file) {
            dataToSend.append('file', formData.file);
        }

        try {
            const data = await createAssessment(dataToSend);
            navigate(`/assessment/manage/${data.assessment_id}`);
        } catch (error) {
            console.error('Assessment creation error:', error);
            alert(`Error: ${error.message || 'Failed to create assessment'}`);
        } finally {
            setLoading(false);
        }
    };

    const cardStyle = {
        background: 'white', borderRadius: '1.25rem', padding: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.8)',
    };
    const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 };
    const inputStyle = {
        width: '100%', padding: '0.75rem 1rem', background: 'white',
        border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem',
        color: '#0f172a', outline: 'none', boxSizing: 'border-box',
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '2rem', maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <button
                    onClick={() => navigate('/assessment')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                        border: 'none', color: '#64748b', fontSize: '0.875rem', fontWeight: 500,
                        cursor: 'pointer', marginBottom: 8, padding: 0,
                    }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Create New Assessment</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Build an assessment using AI-generated questions or upload your own.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* ── Assessment Details ── */}
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', marginTop: 0 }}>
                        Assessment Details
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Title *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                style={inputStyle}
                                placeholder="e.g., React Fundamentals Quiz"
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{ ...inputStyle, height: 80, resize: 'none' }}
                                placeholder="Brief description of the assessment..."
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Difficulty Level</label>
                            <select
                                value={formData.difficulty}
                                onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> Valid From
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.scheduledFrom}
                                    onChange={e => setFormData({ ...formData, scheduledFrom: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> Valid Until
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.scheduledTo}
                                    onChange={e => setFormData({ ...formData, scheduledTo: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>
                                    <Clock size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> Duration (min)
                                </label>
                                <input
                                    type="number"
                                    value={formData.durationMinutes}
                                    onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                                    style={inputStyle}
                                    min="5"
                                    step="5"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>
                                    <Clock size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> Per-Question (sec)
                                </label>
                                <input
                                    type="number"
                                    value={formData.timePerQuestion}
                                    onChange={e => setFormData({ ...formData, timePerQuestion: parseInt(e.target.value) })}
                                    style={inputStyle}
                                    min="0"
                                    step="5"
                                    placeholder="0 = no limit"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Questions Source ── */}
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', marginTop: 0 }}>
                        Questions Source
                    </h2>

                    {/* Mode tabs */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
                        padding: 4, background: '#f1f5f9', borderRadius: 8, marginBottom: '1.25rem',
                    }}>
                        <button type="button" onClick={() => setMode('generate')}
                            style={{
                                padding: '0.625rem', border: 'none', borderRadius: 6, cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.875rem',
                                background: mode === 'generate' ? 'white' : 'transparent',
                                color: mode === 'generate' ? '#0f172a' : '#64748b',
                                boxShadow: mode === 'generate' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            <Wand2 size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                            AI Generate
                        </button>
                        <button type="button" onClick={() => setMode('upload')}
                            style={{
                                padding: '0.625rem', border: 'none', borderRadius: 6, cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.875rem',
                                background: mode === 'upload' ? 'white' : 'transparent',
                                color: mode === 'upload' ? '#0f172a' : '#64748b',
                                boxShadow: mode === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            <Upload size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                            Upload File
                        </button>
                    </div>

                    {mode === 'upload' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Guide */}
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1e40af', fontSize: '0.875rem' }}>
                                        <Info size={18} /> PDF Formatting Guide
                                    </div>
                                    <button type="button" onClick={() => setShowGuide(!showGuide)}
                                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                        {showGuide ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                {/* Downloads */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: showGuide ? 12 : 0 }}>
                                    <a href="/example-questions.xlsx" download style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                                        background: '#1d6f42', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                                        borderRadius: 6, textDecoration: 'none',
                                    }}><Download size={12} /> Excel</a>
                                    <a href="/example-questions.csv" download style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                                        background: '#059669', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                                        borderRadius: 6, textDecoration: 'none',
                                    }}><Download size={12} /> CSV</a>
                                    <button type="button" onClick={generateExamplePDF} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                                        background: '#dc2626', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                                        borderRadius: 6, border: 'none', cursor: 'pointer',
                                    }}><Download size={12} /> PDF</button>
                                    <a href="/example-questions.txt" download style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                                        background: '#64748b', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                                        borderRadius: 6, textDecoration: 'none',
                                    }}><Download size={12} /> TXT</a>
                                </div>
                                {showGuide && (
                                    <div style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.6 }}>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}><CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span><strong>Question:</strong> Start with number + period (e.g., 1.)</span></div>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}><CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span><strong>Options:</strong> List as A), B), C), D)</span></div>
                                        <div style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span><strong>Answer:</strong> Mark with "Answer: A" (letter only)</span></div>
                                    </div>
                                )}
                            </div>
                            {/* File upload */}
                            <div>
                                <input type="file" id="file-upload" style={{ display: 'none' }}
                                    accept=".pdf,.csv,.txt,.xlsx,.xls"
                                    onChange={handleFileChange} />
                                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                                        padding: '2.5rem', border: '2px dashed', borderColor: formData.file ? '#0066b3' : '#cbd5e1',
                                        borderRadius: '1rem', textAlign: 'center', background: formData.file ? '#eff6ff' : '#f8fafc',
                                    }}>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: 14,
                                            background: formData.file ? '#cce7ff' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {formData.file ? <FileText size={28} color="#0066b3" /> : <Upload size={28} color="#94a3b8" />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                                                {formData.file ? formData.file.name : 'Drop file here or click to browse'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PDF, Excel, CSV, or TXT files</div>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {formData.parsedQuestions.length > 0 && (
                                <div className="bg-white border-2 border-blue-500 rounded-2xl p-6 mt-4 animate-slide-in">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="text-blue-500" size={20} />
                                        Previewing {formData.parsedQuestions.length} Questions
                                    </h3>
                                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {formData.parsedQuestions.map((q, idx) => (
                                            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                                                <div className="font-bold text-slate-800 mb-1">{idx + 1}. {q.text}</div>
                                                <div className="grid grid-cols-2 gap-2 text-slate-500 text-xs">
                                                    {q.options.map(opt => (
                                                        <div key={opt.id} className={q.correct_option_id === opt.id ? 'text-green-600 font-bold' : ''}>
                                                            {opt.id}. {opt.text}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-4 text-xs text-slate-400">
                                        Questions were extracted from your file. You can still modify them in the management panel after creation.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label style={labelStyle}>Describe the questions you want to generate</label>
                            <textarea
                                value={formData.prompt}
                                onChange={e => setFormData({ ...formData, prompt: e.target.value })}
                                style={{ ...inputStyle, height: 120, resize: 'none' }}
                                placeholder="e.g., Create 10 multiple choice questions about React Hooks for intermediate developers"
                                required={mode === 'generate'}
                            />
                        </div>
                    )}
                </div>

                {/* ── Assign Candidates ── */}
                <div style={cardStyle}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={20} /> Assign to Candidates
                    </h2>
                    {candidates.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No candidates available. Create candidate accounts first.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: 250, overflowY: 'auto' }}>
                            {candidates.map(c => (
                                <label key={c.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
                                    borderRadius: '0.75rem', border: `2px solid ${formData.selectedCandidates.includes(c.id) ? '#0066b3' : '#e2e8f0'}`,
                                    background: formData.selectedCandidates.includes(c.id) ? '#eff6ff' : 'white',
                                    cursor: 'pointer', transition: 'all 200ms',
                                }}>
                                    <input type="checkbox"
                                        checked={formData.selectedCandidates.includes(c.id)}
                                        onChange={() => toggleCandidate(c.id)}
                                        style={{ width: 18, height: 18, accentColor: '#0066b3' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.email}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Submit ── */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" onClick={() => navigate('/assessment')}
                        style={{
                            flex: 1, padding: '0.875rem', background: 'white', border: '2px solid #e2e8f0',
                            borderRadius: '0.75rem', fontWeight: 600, fontSize: '0.875rem', color: '#475569',
                            cursor: 'pointer',
                        }}>
                        Cancel
                    </button>
                    <button type="submit"
                        disabled={loading || !formData.title || (mode === 'generate' && !formData.prompt) || (mode === 'upload' && !formData.file)}
                        style={{
                            flex: 1, padding: '0.875rem',
                            background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                            color: 'white', border: 'none', borderRadius: '0.75rem',
                            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: loading || !formData.title ? 0.5 : 1,
                            boxShadow: '0 4px 15px rgba(0,102,179,0.35)',
                        }}>
                        {loading ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : <><Sparkles size={20} /> Create Assessment</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
