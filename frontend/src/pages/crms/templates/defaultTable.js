const defaultTableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 0.5rem 0;">
    <thead>
        <tr style="background-color: {{table_header_color}}; text-align: left;">
            <th style="padding: 0.5rem 0.75rem; border-bottom: 2px solid #e5e7eb; color: #374151;">Description</th>
            <th style="padding: 0.5rem 0.75rem; border-bottom: 2px solid #e5e7eb; text-align: center; color: #374151;">Qty</th>
            <th style="padding: 0.5rem 0.75rem; border-bottom: 2px solid #e5e7eb; text-align: right; color: #374151;">Price</th>
            <th style="padding: 0.5rem 0.75rem; border-bottom: 2px solid #e5e7eb; text-align: right; color: #374151;">Amount</th>
        </tr>
    </thead>
    <tbody>
        {{items_rows}}
    </tbody>
</table>
<table style="width: 50%; border-collapse: collapse; margin-top: 0.5rem; margin-left: auto;">
    <tbody>
        <tr>
            <td style="padding: 0.35rem 0.75rem; text-align: right; font-weight: 600; color: #374151;">Subtotal</td>
            <td style="padding: 0.35rem 0.75rem; text-align: right; width: 150px; color: #374151;">{{subtotal}}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0.75rem; text-align: right; font-weight: 600; color: #374151;">{{tax_label}}</td>
            <td style="padding: 0.35rem 0.75rem; text-align: right; width: 150px; color: #374151;">{{tax}}</td>
        </tr>
        {{discount_row}}
        <tr style="background-color: {{table_total_color}};">
            <td style="padding: 0.5rem 0.75rem; text-align: right; font-weight: 700; font-size: 1.1rem; color: #111827;">Total</td>
            <td style="padding: 0.5rem 0.75rem; text-align: right; width: 150px; font-weight: 700; font-size: 1.1rem; color: #111827;">{{total}}</td>
        </tr>
    </tbody>
</table>`;

export default defaultTableHtml;
