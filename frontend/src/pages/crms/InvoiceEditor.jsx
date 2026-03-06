import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import { Plus, Trash2, ArrowLeft, Printer, Save, Eye, EyeOff, RefreshCw, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { crmInvoicesApi, crmCustomersApi, dealsApi, crmInvoiceTemplatesApi } from '../../services/crms_api';
import { currencyApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { defaultHeaderHtml, defaultFooterHtml, defaultTableHtml } from './templates';
import { sanitizeHtml } from './utils/htmlUtils';
import { formatCurrency } from './utils/formatCurrency';
import { processPlaceholders, generateItemRowsHtml, restructureTableLayout } from './utils/templateRenderer';
import './Invoice.css';

let _nextItemId = 1;

const InvoiceEditor = forwardRef(({ invoice, onClose, viewOnly = false, showPreview = false, downloadOnLoad = false, isSilentDownload = false }, ref) => {
    const paperRef = useRef(null);
    const hasDownloaded = useRef(false);
    const [formData, setFormData] = useState({
        deal_id: '',
        customer_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Draft',
        currency: 'USD',
        items: [{ _id: _nextItemId++, description: '', quantity: 1, price: 0, amount: 0 }],
        tax_rate: 0,
        discount: 0,
        discount_percent: 0,
        notes: '',
        template_id: '',
        header_html: '',
        footer_html: '',
        items_html: '',
        table_header_color: '#f3f4f6',
        table_total_color: '#f0fdf4'
    });

    const [customers, setCustomers] = useState([]);
    const [deals, setDeals] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [currencies, setCurrencies] = useState(['USD', 'INR', 'SGD']);
    const [saving, setSaving] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const { showToast } = useToast();

    useImperativeHandle(ref, () => ({
        save: handleSave,
        download: handleDownloadPDF
    }));

    useEffect(() => {
        fetchInitialData();
    }, [invoice]);

    const fetchInitialData = async () => {
        setPageLoading(true);
        try {
            const [custRes, dealsRes, tempRes, currRes, nextNumRes] = await Promise.all([
                crmCustomersApi.getAll(),
                dealsApi.getAll(),
                crmInvoiceTemplatesApi.getAll(),
                currencyApi.getCurrencies().catch(() => ({ data: [] })),
                !invoice ? crmInvoicesApi.getNextNumber().catch(() => ({ data: { next_number: '' } })) : Promise.resolve({ data: { next_number: '' } })
            ]);

            const custList = custRes.data || (Array.isArray(custRes) ? custRes : []);
            const dealsList = dealsRes.data || (Array.isArray(dealsRes) ? dealsRes : []);
            const templatesList = tempRes.data || (Array.isArray(tempRes) ? tempRes : []);
            const currList = currRes.data || (Array.isArray(currRes) ? currRes : []);
            const nextInvoiceNumber = nextNumRes.data?.next_number || '';

            setCustomers(custList);
            setDeals(dealsList);
            setTemplates(templatesList);
            if (currList.length > 0) setCurrencies(currList);

            // Initialize with default values
            let initialData = {
                deal_id: '',
                customer_id: '',
                invoice_number: '',
                issue_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'Draft',
                currency: 'USD',
                items: [{ _id: _nextItemId++, description: '', quantity: 1, price: 0, amount: 0 }],
                tax_rate: 0,
                discount: 0,
                discount_percent: 0,
                notes: '',
                template_id: '',
                header_html: '',
                footer_html: '',
                items_html: '',
                table_header_color: '#f3f4f6',
                table_total_color: '#f0fdf4'
            };

            // If editing an existing invoice, merge it
            if (invoice) {
                initialData = {
                    ...initialData,
                    ...invoice,
                    items: (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || [])).map(item => ({ ...item, _id: item._id || _nextItemId++ }))
                };
            }

            // Auto-select defaults for new invoices or load template data for existing ones
            if (!invoice) {
                if (nextInvoiceNumber) {
                    initialData.invoice_number = nextInvoiceNumber;
                }

                if (templatesList.length > 0) {
                    const defaultTemp = templatesList.find(t => {
                        const val = t.is_default;
                        return val === true || val === 'true' || val === 'True' || val === 1 || val === '1';
                    }) || templatesList[0];

                    if (defaultTemp) {
                        initialData.template_id = String(defaultTemp.id);
                        initialData.header_html = defaultTemp.header_html || '';
                        initialData.footer_html = defaultTemp.footer_html || '';
                        initialData.items_html = defaultTemp.items_html || '';
                        initialData.table_header_color = defaultTemp.table_header_color || '#f3f4f6';
                        initialData.table_total_color = defaultTemp.table_total_color || '#f0fdf4';
                    }
                }
            } else if (initialData.template_id && templatesList.length > 0) {
                // For existing invoices, match with template to get HTML content
                const mappedTemp = templatesList.find(t => String(t.id) === String(initialData.template_id));
                if (mappedTemp) {
                    initialData.header_html = mappedTemp.header_html || '';
                    initialData.footer_html = mappedTemp.footer_html || '';
                    initialData.items_html = mappedTemp.items_html || '';
                    initialData.table_header_color = mappedTemp.table_header_color || '#f3f4f6';
                    initialData.table_total_color = mappedTemp.table_total_color || '#f0fdf4';
                }
            }

            setFormData(initialData);
            if (downloadOnLoad && isSilentDownload && !hasDownloaded.current) {
                hasDownloaded.current = true;
                setTimeout(handleDownloadPDF, 1500);
            }

        } catch (error) {
            logger.error('Error fetching initial data:', error);
        } finally {
            setPageLoading(false);
        }
    };

    const handleTemplateChange = async (templateId) => {
        if (templateId === 'NEW_TEMPLATE') {
            window.open('/crms/invoice-templates?action=new', '_blank');
            return;
        }
        try {
            const template = templates.find(t => String(t.id) === String(templateId));
            if (template) {
                setFormData(prev => ({
                    ...prev,
                    template_id: String(templateId),
                    header_html: template.header_html,
                    footer_html: template.footer_html,
                    items_html: template.items_html,
                    table_header_color: template.table_header_color || '#f3f4f6',
                    table_total_color: template.table_total_color || '#f0fdf4'
                }));
            }
        } catch (error) {
            logger.error('Error selecting template:', error);
        }
    };

    const handleCustomerChange = (customerId) => {
        if (customerId === 'NEW_CUSTOMER') {
            window.open('/crms/customers?action=new', '_blank');
            return;
        }
        setFormData({ ...formData, customer_id: customerId });
    };

    const handleDealChange = (dealId) => {
        if (dealId === 'NEW_DEAL') {
            window.open('/crms/deals?action=new', '_blank');
            return;
        }

        const selectedDeal = deals.find(d => String(d.id) === String(dealId));
        if (selectedDeal) {
            setFormData(prev => ({
                ...prev,
                deal_id: dealId,
                customer_id: selectedDeal.customer_id || prev.customer_id,
                currency: selectedDeal.currency || prev.currency
            }));
        } else {
            setFormData(prev => ({ ...prev, deal_id: dealId }));
        }
    };

    /** Auto-set due_date = issue_date + 60 days on blur */
    const handleIssueDateBlur = () => {
        if (formData.issue_date) {
            const issueDate = new Date(formData.issue_date);
            const dueDate = new Date(issueDate.getTime() + 60 * 24 * 60 * 60 * 1000);
            setFormData(prev => ({ ...prev, due_date: dueDate.toISOString().split('T')[0] }));
        }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { _id: _nextItemId++, description: '', quantity: 1, price: 0, amount: 0 }]
        });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        if (field === 'quantity' || field === 'price') {
            newItems[index].amount = (newItems[index].quantity || 0) * (newItems[index].price || 0);
        }
        setFormData({ ...formData, items: newItems });
    };

    /** Calculate invoice totals. Memoized for performance. */
    const totals = useMemo(() => {
        const subtotal = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxAmount = (subtotal * (formData.tax_rate || 0)) / 100;
        const discountAmount = formData.discount || 0;
        const total = subtotal + taxAmount - discountAmount;
        return { subtotal, taxAmount, discountAmount, total };
    }, [formData.items, formData.tax_rate, formData.discount]);

    /** Wrap formatCurrency with the current currency code. */
    const fmtCurrency = useCallback(
        (amount) => formatCurrency(amount, formData.currency),
        [formData.currency]
    );

    /** Simple structured logger to replace bare console.error */
    const logger = useMemo(() => ({
        error: (msg, err) => console.error(`[InvoiceEditor] ${msg}`, err || ''),
        warn: (msg) => console.warn(`[InvoiceEditor] ${msg}`),
    }), []);

    const handleTaxRateChange = (rate) => {
        setFormData(prev => ({ ...prev, tax_rate: rate }));
    };

    const handleDiscountPercentChange = (pct) => {
        const base = totals.subtotal + totals.taxAmount;
        const amount = (base * (pct || 0)) / 100;
        setFormData(prev => ({ ...prev, discount_percent: pct, discount: Math.round(amount * 100) / 100 }));
    };

    const handleDiscountAmountChange = (amount) => {
        const base = totals.subtotal + totals.taxAmount;
        const pct = base > 0 ? (amount / base) * 100 : 0;
        setFormData(prev => ({ ...prev, discount: amount, discount_percent: Math.round(pct * 100) / 100 }));
    };

    const handleSave = async () => {
        if (!formData.customer_id || !formData.invoice_number) {
            showToast('Please fill in all required fields (Invoice ID, Customer)', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                items: formData.items,
                total_amount: totals.total
            };

            if (invoice?.id) {
                await crmInvoicesApi.update(invoice.id, payload);
                showToast('Invoice updated successfully', 'success');
            } else {
                await crmInvoicesApi.create(payload);
                showToast('Invoice created successfully', 'success');
            }
            onClose();
        } catch (error) {
            logger.error('Error saving invoice:', error);
            showToast('Failed to save invoice', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        const element = paperRef.current;
        if (!element) return;

        const invNum = invoice?.invoice_number || formData?.invoice_number || invoice?.id || 'GTINV';

        try {
            // --- 1. Create an off-screen iframe for isolated rendering ---
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.left = '-9999px';
            iframe.style.top = '0';
            iframe.style.width = '210mm';
            iframe.style.height = '297mm';
            iframe.style.border = 'none';
            iframe.style.visibility = 'hidden';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // --- 2. Copy all stylesheets into the iframe ---
            iframeDoc.open();
            iframeDoc.write('<!DOCTYPE html><html><head>');

            // Copy linked stylesheets
            const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
            styleSheets.forEach(sheet => {
                iframeDoc.write(sheet.outerHTML);
            });

            // Add overrides for PDF rendering
            iframeDoc.write(`<style>
                body { margin: 0; padding: 0; background: white; }
                .invoice-paper {
                    width: 210mm !important;
                    min-height: 297mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                /* Force all direct children of invoice-paper to fill the full width */
                .invoice-paper > div {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                /* Ensure images in header/footer fill their containers */
                .invoice-paper img {
                    max-width: 100% !important;
                    height: auto !important;
                }
                .footer-wrapper img {
                    width: 100% !important;
                    display: block !important;
                }
            </style>`);

            iframeDoc.write('</head><body>');
            iframeDoc.write(element.outerHTML);
            iframeDoc.write('</body></html>');
            iframeDoc.close();

            // --- 3. Wait for iframe to fully render (stylesheets + images) ---
            await new Promise(resolve => {
                iframe.onload = resolve;
                // Fallback timeout in case onload doesn't fire
                setTimeout(resolve, 1000);
            });
            // Extra buffer for fonts and images
            await new Promise(r => setTimeout(r, 500));

            const cloneInFrame = iframeDoc.querySelector('.invoice-paper');
            if (!cloneInFrame) {
                throw new Error('Could not find invoice element in iframe');
            }

            // --- 4. Capture with html2canvas ---
            const canvas = await html2canvas(cloneInFrame, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            // --- 5. Generate PDF from canvas ---
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            const pdfWidth = 210;
            const pdfHeight = 297;
            const canvasAspect = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasAspect;

            // Always use full A4 width
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));

            pdf.save(`Invoice_${invNum}.pdf`);

            // --- 6. Cleanup ---
            document.body.removeChild(iframe);

        } catch (err) {
            console.error('Error generating PDF:', err);
            showToast('Failed to generate PDF', 'error');
        } finally {
            if (isSilentDownload) {
                setTimeout(() => {
                    onClose();
                }, 500);
            }
        }
    };

    /**
     * Render template HTML by replacing all placeholders with actual invoice data.
     * Uses shared processPlaceholders utility for XSS-safe rendering.
     * @param {string} html - Template HTML with placeholders
     * @returns {string} Processed HTML
     */
    const renderPreviewHtml = useCallback((html) => {
        if (!html) return '';
        const customer = customers.find(c => String(c.id) === String(formData.customer_id));
        const deal = deals.find(d => String(d.id) === String(formData.deal_id));
        return processPlaceholders(html, {
            customer,
            deal,
            formData,
            totals,
            formatCurrency: fmtCurrency,
        });
    }, [customers, deals, formData, totals, fmtCurrency]);

    // totals is already memoized above

    /** Memoized items HTML — avoids DOMParser on every render. */
    const processedItemsHtml = useMemo(() => {
        if (!formData.items_html) return null;
        const itemRowsHtml = generateItemRowsHtml(formData.items, fmtCurrency);

        // Process placeholders on the items/table template
        let html = processPlaceholders(formData.items_html, {
            customer: customers.find(c => String(c.id) === String(formData.customer_id)),
            deal: deals.find(d => String(d.id) === String(formData.deal_id)),
            formData,
            totals,
            formatCurrency: fmtCurrency,
        });
        // Remove items_rows placeholder (we inject via DOM restructuring)
        html = html.replace(/\{\{items_rows\}\}/g, '');

        // Restructure table layout (inject rows, right-align totals)
        return restructureTableLayout(html, itemRowsHtml);
    }, [formData.items_html, formData.items, formData.table_header_color, formData.table_total_color,
    formData.discount, formData.tax_rate, formData.currency,
        customers, deals, totals, fmtCurrency]);

    const renderPreviewContent = () => (
        <div className="invoice-paper" ref={paperRef}>
            {/* Header */}
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(formData.header_html || defaultHeaderHtml)) }} />

            <div className="preview-body" style={{ flex: 1, paddingTop: 0 }}>
                {processedItemsHtml ? (
                    <div
                        style={{ marginTop: 0 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedItemsHtml) }}
                    />
                ) : (
                    <table className="items-table" style={{ marginTop: '2rem' }}>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Price</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.items.map((item, i) => (
                                <tr key={item._id}>
                                    <td>{item.description}</td>
                                    <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtCurrency(item.price)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCurrency(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Totals - only show if no custom items template (which includes its own totals) */}
                {!formData.items_html && (
                    <div className="totals-section">
                        <div className="totals-grid">
                            <div className="total-row">
                                <span>Subtotal</span>
                                <span>{fmtCurrency(totals.subtotal)}</span>
                            </div>
                            <div className="total-row">
                                <span>Tax ({formData.tax_rate}%)</span>
                                <span>{fmtCurrency(totals.taxAmount)}</span>
                            </div>
                            {formData.discount > 0 && (
                                <div className="total-row">
                                    <span>Discount</span>
                                    <span>- {fmtCurrency(formData.discount)}</span>
                                </div>
                            )}
                            <div className="grand-total" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total</span>
                                <span>{fmtCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {formData.notes && (
                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-100)' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Notes</h4>
                        <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>{formData.notes}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="footer-wrapper" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreviewHtml(formData.footer_html || defaultFooterHtml)) }} />
        </div>
    );

    return (
        <div className={isSilentDownload ? 'opacity-0 pointer-events-none absolute -left-[9999px] -top-[9999px] w-[210mm] min-h-[297mm]' : ''}>
            {pageLoading ? (
                <div className="ie-loading-container">
                    <div className="ie-progress-track">
                        <div className="ie-progress-bar"></div>
                    </div>
                    <p className="ie-loading-text">
                        {showPreview ? 'Preparing Preview...' : 'Preparing Editor...'}
                    </p>
                </div>
            ) : showPreview ? (
                <div className="invoice-modal-body" style={{ background: 'var(--gray-100)', minHeight: '100%', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                    {renderPreviewContent()}
                </div>
            ) : (
                <div className="invoice-editor-container">
                    {/* General Information */}
                    <div className="ie-section">
                        <h3 className="ie-section-title">General Information</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Invoice ID <span style={{ color: 'var(--error-600)' }}>*</span></label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. INV-2024-001"
                                    value={formData.invoice_number}
                                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Template</label>
                                <select
                                    className="form-select"
                                    value={formData.template_id || ''}
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                >
                                    <option value="">Select a Template</option>
                                    <option value="NEW_TEMPLATE">+ Add New Template</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={String(t.id)}>
                                            {t.name} {t.is_default ? '(Default)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Deal</label>
                                <select
                                    className="form-select"
                                    value={formData.deal_id || ''}
                                    onChange={(e) => handleDealChange(e.target.value)}
                                >
                                    <option value="">Select Deal</option>
                                    <option value="NEW_DEAL">+ Add New Deal</option>
                                    {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Customer <span style={{ color: 'var(--error-600)' }}>*</span></label>
                                <select
                                    className="form-select"
                                    value={formData.customer_id}
                                    onChange={(e) => handleCustomerChange(e.target.value)}
                                >
                                    <option value="">Select Customer</option>
                                    <option value="NEW_CUSTOMER">+ Add New Customer</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="ie-row-4">
                            <div className="form-group">
                                <label className="form-label">Issue Date <span style={{ color: 'var(--error-600)' }}>*</span></label>
                                <input type="date" className="form-input" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} onBlur={handleIssueDateBlur} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Due Date <span style={{ color: 'var(--error-600)' }}>*</span></label>
                                <input type="date" className="form-input" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="Draft">Draft</option>
                                    <option value="Sent">Sent</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Overdue">Overdue</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            {formData.payment_date && (
                                <div className="form-group">
                                    <label className="form-label">Payment Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.payment_date}
                                        readOnly
                                        style={{ background: 'var(--gray-50)' }}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Currency <span style={{ color: 'var(--error-600)' }}>*</span></label>
                                <select
                                    className="form-select"
                                    value={formData.currency}
                                    onChange={(e) => {
                                        if (e.target.value === 'NEW_CURRENCY') {
                                            window.open('/hrms/currency?action=new', '_blank');
                                            return;
                                        }
                                        setFormData({ ...formData, currency: e.target.value });
                                    }}
                                >
                                    {currencies.map(code => {
                                        const sym = { USD: '$', EUR: '€', INR: '₹', GBP: '£', SGD: 'S$', AED: 'د.إ', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'Fr' }[code] || code;
                                        return <option key={code} value={code}>{code} ({sym})</option>;
                                    })}
                                    <option value="NEW_CURRENCY">+ Manage Currencies</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="ie-section">
                        <div className="ie-section-header">
                            <h3 className="ie-section-title">Line Items</h3>
                            <button onClick={addItem} className="btn btn-success btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="ie-table-wrap">
                            <table className="ie-line-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40%' }}>Description</th>
                                        <th style={{ width: '12%' }}>Qty</th>
                                        <th style={{ width: '18%' }}>Price</th>
                                        <th style={{ width: '22%', textAlign: 'right' }}>Amount</th>
                                        <th style={{ width: '8%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                <input type="text" className="form-input" placeholder="Item description" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
                                            </td>
                                            <td>
                                                <input type="number" className="form-input" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                                            </td>
                                            <td>
                                                <input type="number" className="form-input" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} />
                                            </td>
                                            <td className="ie-amount-cell">
                                                {fmtCurrency(item.amount)}
                                            </td>
                                            <td className="ie-action-cell">
                                                <button className="ie-delete-btn" onClick={() => removeItem(index)}>
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Summary */}
                        <div className="ie-totals-wrapper">
                            <div className="ie-totals-box">
                                <div className="ie-totals-row">
                                    <span className="ie-totals-label">Subtotal</span>
                                    <span className="ie-totals-value">{fmtCurrency(totals.subtotal)}</span>
                                </div>
                                <div className="ie-totals-row">
                                    <span className="ie-totals-label">Tax</span>
                                    <div className="ie-totals-input-group">
                                        <input type="number" className="form-input ie-totals-input" value={formData.tax_rate} onChange={(e) => handleTaxRateChange(parseFloat(e.target.value) || 0)} />
                                        <span className="ie-totals-unit">%</span>
                                        <span className="ie-totals-eq">:</span>
                                        <span className="ie-totals-value">{fmtCurrency(totals.taxAmount)}</span>
                                    </div>
                                </div>
                                <div className="ie-totals-row">
                                    <span className="ie-totals-label">Discount</span>
                                    <div className="ie-totals-input-group">
                                        <input type="number" className="form-input ie-totals-input" value={formData.discount_percent} onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value) || 0)} />
                                        <span className="ie-totals-unit">%</span>
                                        <span className="ie-totals-eq">:</span>
                                        <input type="number" className="form-input ie-totals-input" value={formData.discount} onChange={(e) => handleDiscountAmountChange(parseFloat(e.target.value) || 0)} />
                                    </div>
                                </div>
                                <div className="ie-totals-row ie-grand-total">
                                    <span className="ie-totals-label">Total</span>
                                    <span className="ie-totals-value">{fmtCurrency(totals.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="ie-section">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Notes & Remarks</label>
                            <textarea
                                className="form-textarea"
                                rows="3"
                                placeholder="Additional instructions or notes..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            ></textarea>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default InvoiceEditor;
