/**
 * Currency locale mapping for Intl.NumberFormat.
 */
const CURRENCY_LOCALES = {
    USD: 'en-US',
    EUR: 'de-DE',
    INR: 'en-IN',
    GBP: 'en-GB',
    SGD: 'en-SG',
    AUD: 'en-AU',
    CAD: 'en-CA',
    JPY: 'ja-JP',
};

/**
 * Format a numeric amount as a currency string.
 * @param {number} amount - The amount to format
 * @param {string} [currencyCode='USD'] - ISO 4217 currency code
 * @returns {string} Formatted currency string (e.g., "$1,234.56")
 */
export const formatCurrency = (amount, currencyCode = 'USD') => {
    const locale = CURRENCY_LOCALES[currencyCode] || 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);
};
