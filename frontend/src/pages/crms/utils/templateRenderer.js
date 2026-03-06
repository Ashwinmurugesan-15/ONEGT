import { escapeHtml } from './htmlUtils';

/**
 * Strip WYSIWYG editor style artifacts from HTML.
 * Removes variable highlight styles inherited from legacy template insertions.
 * @param {string} html - HTML string to clean
 * @returns {string} Cleaned HTML
 */
export const stripEditorStyles = (html) => {
    if (!html) return '';
    let processed = html;
    processed = processed.replace(/background-color:\s*#dbeafe;?/gi, '');
    processed = processed.replace(/color:\s*#2563eb;?/gi, '');
    processed = processed.replace(/padding:\s*0\s*4px;?/gi, '');
    processed = processed.replace(/border-radius:\s*4px;?/gi, '');
    processed = processed.replace(/font-family:\s*monospace;?/gi, '');
    processed = processed.replace(/font-size:\s*0\.85em;?/gi, '');
    return processed;
};

/**
 * Replace template variable placeholders with actual data values.
 * Handles company, customer, deal, invoice, and financial placeholders.
 *
 * @param {string} html - Template HTML with {{variable}} placeholders
 * @param {Object} options
 * @param {Object} options.customer - Customer data
 * @param {Object} options.deal - Deal data
 * @param {Object} options.formData - Invoice form data
 * @param {Object} options.totals - Pre-calculated totals { subtotal, taxAmount, discountAmount, total }
 * @param {Function} options.formatCurrency - Currency formatting function
 * @returns {string} HTML with placeholders replaced
 */
export const processPlaceholders = (html, { customer, deal, formData, totals, formatCurrency }) => {
    if (!html) return '';
    let processed = stripEditorStyles(html);

    const variables = {
        '\\{\\{company\\.name\\}\\}': 'Your Company Name',
        '\\{\\{company\\.address\\}\\}': 'Your Company Address',
        '\\{\\{company\\.phone\\}\\}': 'Your Company Phone',
        '\\{\\{company\\.email\\}\\}': 'company@example.com',
        '\\{\\{customer\\.name\\}\\}': escapeHtml(customer?.name || ''),
        '\\{\\{customer\\.email\\}\\}': escapeHtml(customer?.email || ''),
        '\\{\\{customer\\.phone\\}\\}': escapeHtml(customer?.phone || ''),
        '\\{\\{customer\\.address\\}\\}': escapeHtml(customer?.address || ''),
        '\\{\\{deal\\.name\\}\\}': escapeHtml(deal?.name || ''),
        '\\{\\{deal\\.value\\}\\}': formatCurrency(deal?.value || 0),
        '\\{\\{deal\\.stage\\}\\}': escapeHtml(deal?.stage || ''),
        '\\{\\{deal\\.currency\\}\\}': escapeHtml(formData.currency || deal?.currency || ''),
        '\\{\\{deal\\.po_number\\}\\}': escapeHtml(deal?.po_number || ''),
        '\\{\\{invoice\\.number\\}\\}': escapeHtml(formData.invoice_number || ''),
        '\\{\\{invoice\\.issue_date\\}\\}': escapeHtml(formData.issue_date || ''),
        '\\{\\{invoice\\.due_date\\}\\}': escapeHtml(formData.due_date || ''),
        '\\{\\{invoice\\.subtotal\\}\\}': formatCurrency(totals.subtotal),
        '\\{\\{invoice\\.tax\\}\\}': formatCurrency(totals.taxAmount),
        '\\{\\{invoice\\.discount\\}\\}': formatCurrency(formData.discount),
        '\\{\\{invoice\\.total\\}\\}': formatCurrency(totals.total),
    };

    Object.entries(variables).forEach(([key, val]) => {
        processed = processed.replace(new RegExp(key, 'g'), val);
    });

    // Template colors
    const tc = formData.template_config || {};
    processed = processed.replace(/\{\{primary_color\}\}/g, tc.primary_color || '#2563eb');
    processed = processed.replace(/\{\{secondary_color\}\}/g, tc.secondary_color || '#64748b');
    processed = processed.replace(/\{\{table_header_color\}\}/g, formData.table_header_color || '#f3f4f6');
    processed = processed.replace(/\{\{table_total_color\}\}/g, formData.table_total_color || '#f0fdf4');

    // Financial placeholders (short-form)
    processed = processed.replace(/\{\{subtotal\}\}/g, formatCurrency(totals.subtotal));
    processed = processed.replace(/\{\{tax_label\}\}/g, `Tax (${formData.tax_rate || 0}%)`);
    processed = processed.replace(/\{\{tax\}\}/g, formatCurrency(totals.taxAmount));
    processed = processed.replace(/\{\{total\}\}/g, formatCurrency(totals.total));

    // Discount — conditional on discount > 0
    if (formData.discount > 0) {
        const discountRow = `<tr><td style="padding: 0.35rem 0.75rem; text-align: right; font-weight: 600; color: #374151;">Discount</td><td style="padding: 0.35rem 0.75rem; text-align: right; width: 150px; color: #dc2626;">-${formatCurrency(formData.discount)}</td></tr>`;
        processed = processed.replace(/\{\{discount_row\}\}/g, discountRow);
        processed = processed.replace(/\{\{discount_label\}\}/g, 'Discount');
        processed = processed.replace(/\{\{discount\}\}/g, `-${formatCurrency(formData.discount)}`);
    } else {
        processed = processed.replace(/\{\{discount_row\}\}/g, '');
        processed = processed.replace(/\{\{discount_label\}\}/g, '');
        processed = processed.replace(/\{\{discount\}\}/g, '');
    }

    return processed;
};

/**
 * Generate HTML for item rows with escaped descriptions.
 * @param {Array} items - Array of invoice items
 * @param {Function} formatCurrency - Currency formatting function
 * @returns {string} HTML string of <tr> elements
 */
export const generateItemRowsHtml = (items, formatCurrency) => {
    return items.map(item => `
        <tr>
            <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; width: 50%;">${escapeHtml(item.description)}</td>
            <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: center; width: 10%;">${escapeHtml(item.quantity)}</td>
            <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right; width: 20%;">${formatCurrency(item.price)}</td>
            <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500; width: 20%;">${formatCurrency(item.amount)}</td>
        </tr>
    `).join('');
};

/**
 * Post-process rendered items HTML to fix table layout:
 * - Injects item rows into the first table's tbody
 * - Right-aligns the totals table (second table)
 * - Removes empty container rows leftover from placeholder clearing
 *
 * @param {string} html - Processed HTML (placeholders already replaced)
 * @param {string} itemRowsHtml - Generated item rows HTML
 * @returns {string} Restructured HTML
 */
export const restructureTableLayout = (html, itemRowsHtml) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const wrapper = doc.body.firstChild;
    const tables = wrapper.querySelectorAll('table');

    if (tables.length >= 1) {
        const itemsTable = tables[0];
        itemsTable.style.margin = '0';

        let tbody = itemsTable.querySelector('tbody');
        if (!tbody) {
            tbody = doc.createElement('tbody');
            itemsTable.appendChild(tbody);
        }
        tbody.innerHTML = itemRowsHtml;
    }

    if (tables.length >= 2) {
        const totalsTable = tables[1];
        totalsTable.style.width = '45%';
        totalsTable.style.marginLeft = 'auto';
        totalsTable.style.marginTop = '0.5rem';

        // Remove empty rows left from cleared items_rows placeholder
        const rows = totalsTable.querySelectorAll('tbody > tr');
        if (rows.length > 0) {
            const firstRow = rows[0];
            if (!firstRow.textContent.trim()) {
                firstRow.remove();
            }
        }
    }

    return wrapper.innerHTML;
};
