'use client';

import { useState } from 'react';
import { Edit, Trash2, ExternalLink, Calendar, Play, BarChart2 } from 'lucide-react';

// Helper function to extract YouTube video ID
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

export default function LearningResourceCard({
    resource,
    onEdit,
    onDelete,
    onViewAnalytics,
    showActions = false,
    onRecordView
}) {
    const videoId = getYouTubeVideoId(resource.course_url);
    const isYouTube = resource.url_type === 'youtube' && videoId;
    const [isPlaying, setIsPlaying] = useState(false);
    const [imgError, setImgError] = useState(false);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handlePlay = () => {
        setIsPlaying(true);
        if (onRecordView) onRecordView(resource.id);
    };

    const handleLinkClick = () => {
        if (onRecordView) onRecordView(resource.id);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all group overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{resource.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{resource.description}</p>
                </div>
                {showActions && (
                    <div className="flex gap-2 ml-3">
                        {onViewAnalytics && (
                            <button
                                onClick={onViewAnalytics}
                                className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"
                                title="View Analytics"
                            >
                                <BarChart2 size={16} />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                title="Edit Resource"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Delete Resource"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Video or Link */}
            {isYouTube ? (
                <div className="mb-4 rounded-xl overflow-hidden aspect-video relative group bg-black shadow-inner">
                    {!isPlaying ? (
                        <div
                            className="absolute inset-0 cursor-pointer group"
                            onClick={handlePlay}
                        >
                            <img
                                src={imgError
                                    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                                    : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                                }
                                onError={() => setImgError(true)}
                                alt={resource.title}
                                className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-14 h-14 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                    <Play size={28} className="text-white ml-1" fill="white" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                            title={resource.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                        ></iframe>
                    )}
                </div>
            ) : resource.image_url ? (
                <div className="mb-4 rounded-xl overflow-hidden aspect-video relative group border border-gray-100 shadow-inner">
                    <img
                        src={resource.image_url}
                        alt={resource.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a
                            href={resource.course_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleLinkClick}
                            className="px-5 py-2.5 bg-white text-amber-700 rounded-full font-bold hover:bg-amber-50 transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
                        >
                            <ExternalLink size={16} />
                            Open Resource
                        </a>
                    </div>
                </div>
            ) : (
                <a
                    href={resource.course_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                    className="flex flex-col items-center justify-center gap-3 p-8 bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-xl hover:bg-amber-50 transition-all mb-4 group/btn"
                >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover/btn:scale-110 transition-transform">
                        <ExternalLink size={24} className="text-amber-600" />
                    </div>
                    <span className="font-bold text-amber-800">Visit Course Link</span>
                </a>
            )}

            {/* Footer Metadata */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                    <Calendar size={14} className="text-gray-300" />
                    {formatDate(resource.created_at)}
                </div>
                {isYouTube && !isPlaying && (
                    <a
                        href={`https://www.youtube.com/watch?v=${videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleLinkClick}
                        className="text-[10px] font-bold text-red-600 hover:underline uppercase tracking-wider"
                    >
                        YouTube External
                    </a>
                )}
            </div>
        </div>
    );
}
