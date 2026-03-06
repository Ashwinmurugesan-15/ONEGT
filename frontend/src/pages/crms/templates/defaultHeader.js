const defaultHeaderHtml = `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
    <div>
        <h1 style="font-size: 1.5rem; font-weight: bold; color: {{primary_color}}; margin: 0;">{{company.name}}</h1>
        <p style="color: #6b7280; margin: 0.5rem 0;">{{company.address}}</p>
    </div>
    <div style="text-align: right;">
        <h2 style="font-size: 2rem; font-weight: bold; color: {{primary_color}}; margin: 0;">INVOICE</h2>
        <p style="font-size: 1.25rem; color: #6b7280; margin: 0.5rem 0;">#{{invoice.number}}</p>
    </div>
</div>`;

export default defaultHeaderHtml;
