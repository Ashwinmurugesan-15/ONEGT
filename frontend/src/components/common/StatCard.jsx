function StatCard({ icon: Icon, value, label, title, color = 'blue', trend, subtitle }) {
    const displayLabel = label || title;

    return (
        <div className="stat-card">
            <div className={`stat-card-icon ${color}`}>
                <Icon size={24} />
            </div>
            <div className="stat-card-value">{value}</div>
            <div className="stat-card-label">{displayLabel}</div>
            {subtitle && (
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--gray-500)',
                    marginTop: '0.25rem',
                    fontWeight: '400'
                }}>
                    {subtitle}
                </div>
            )}
            {trend && (
                <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: trend > 0 ? 'var(--success-600)' : 'var(--error-600)'
                }}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last period
                </div>
            )}
        </div>
    );
}

export default StatCard;
