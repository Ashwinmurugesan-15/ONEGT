import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks.
 * Removes dangerous tags (script, iframe, etc.) while preserving safe HTML.
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML safe for dangerouslySetInnerHTML
 */
export const sanitizeHtml = (html) => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'td', 'th', 'tfoot',
            'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
            'ul', 'ol', 'li', 'a', 'img', 'font', 'label',
            'blockquote', 'pre', 'code'
        ],
        ALLOWED_ATTR: [
            'style', 'class', 'id', 'href', 'src', 'alt', 'title', 'target',
            'width', 'height', 'align', 'valign', 'colspan', 'rowspan',
            'border', 'cellpadding', 'cellspacing',
            'color', 'face', 'size', 'ref'
        ],
        ALLOW_DATA_ATTR: false,
    });
};

/**
 * Escape HTML entities to prevent XSS when interpolating user data into HTML strings.
 * @param {string} str - Raw string to escape
 * @returns {string} Escaped string safe for HTML interpolation
 */
export const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
