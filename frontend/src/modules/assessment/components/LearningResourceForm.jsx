import { useState, useEffect } from 'react';
import { Save, X, ExternalLink, Loader2 } from 'lucide-react';

function getYouTubeVideoId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

export default function LearningResourceForm({ resource, onSave, onCancel, loading = false }) {
    const [title, setTitle] = useState(resource?.title || '');
    const [description, setDescription] = useState(resource?.description || '');
    const [courseUrl, setCourseUrl] = useState(resource?.course_url || '');
    const [imageUrl, setImageUrl] = useState(resource?.image_url || '');
    const [isYouTube, setIsYouTube] = useState(false);

    useEffect(() => {
        setIsYouTube(!!getYouTubeVideoId(courseUrl));
    }, [courseUrl]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (title && description && courseUrl) {
            onSave({
                title,
                description,
                course_url: courseUrl,
                image_url: imageUrl,
                url_type: isYouTube ? 'youtube' : 'generic'
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                    Course Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                        width: '100%', padding: '0.75rem 1rem', background: 'white',
                        border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem',
                        color: '#0f172a', outline: 'none', boxSizing: 'border-box',
                    }}
                    placeholder="e.g., React Fundamentals"
                    required
                />
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                    Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    style={{
                        width: '100%', padding: '0.75rem 1rem', background: 'white',
                        border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem',
                        color: '#0f172a', outline: 'none', boxSizing: 'border-box', resize: 'none',
                    }}
                    placeholder="Describe what this course covers..."
                    required
                />
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                    Course URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                    type="url"
                    value={courseUrl}
                    onChange={(e) => setCourseUrl(e.target.value)}
                    style={{
                        width: '100%', padding: '0.75rem 1rem', background: 'white',
                        border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem',
                        color: '#0f172a', outline: 'none', boxSizing: 'border-box',
                    }}
                    placeholder="https://www.youtube.com/watch?v=... or any course URL"
                    required
                />
                {isYouTube && (
                    <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExternalLink size={14} /> YouTube video detected - will be embedded
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
                <button
                    type="submit"
                    disabled={loading || !title || !description || !courseUrl}
                    style={{
                        flex: 1, padding: '0.75rem',
                        background: 'linear-gradient(135deg, #0066b3 0%, #0080cc 50%, #5cc8e6 100%)',
                        color: 'white', border: 'none', borderRadius: '0.75rem',
                        fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 4px 15px rgba(0,102,179,0.3)',
                        opacity: (loading || !title || !description || !courseUrl) ? 0.6 : 1,
                    }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {loading ? 'Saving...' : resource ? 'Update Resource' : 'Create Resource'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    style={{
                        padding: '0.75rem 1.5rem', background: 'white', border: '2px solid #e2e8f0',
                        borderRadius: '0.75rem', fontWeight: 600, fontSize: '0.875rem', color: '#64748b',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                >
                    <X size={18} />
                    Cancel
                </button>
            </div>
        </form>
    );
}
