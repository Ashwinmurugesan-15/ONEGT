/**
 * Converts a Google Drive share link to a direct image URL suitable for <img> tags.
 * Handles: drive.google.com URLs, localhost URLs (from dev), and googleusercontent URLs.
 * Uses Google's direct thumbnail service (lh3.googleusercontent.com) for reliable cross-environment loading.
 */
export const getDriveDirectLink = (url) => {
    if (!url) return '';

    // If the URL contains localhost, extract the file ID from the proxy path
    // and convert to a direct Google Drive thumbnail URL
    if (url.includes('localhost')) {
        try {
            const urlObj = new URL(url);
            const proxyMatch = urlObj.pathname.match(/drive-proxy\/(.+)/);
            if (proxyMatch && proxyMatch[1]) {
                return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}`;
            }
            return urlObj.pathname;
        } catch {
            return url;
        }
    }

    // Google profile photos (googleusercontent.com) - pass through as-is
    if (url.includes('googleusercontent.com')) return url;

    // Not a Drive link - pass through
    if (!url.includes('drive.google.com')) return url;
    if (url.includes('uc?export=view')) return url;

    try {
        // Extract ID from URL
        let fileId = '';
        const urlObj = new URL(url);

        if (url.includes('/open')) {
            fileId = urlObj.searchParams.get('id');
        } else if (url.includes('/file/d/')) {
            // Format: https://drive.google.com/file/d/FILE_ID/view
            const parts = url.split('/file/d/');
            if (parts.length > 1) {
                fileId = parts[1].split('/')[0];
            }
        }

        if (fileId) {
            // Use Google's direct thumbnail service - works for public files
            // without needing a backend proxy
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
    } catch (e) {
        console.error('Error parsing Drive URL:', e);
    }

    return url;
};
