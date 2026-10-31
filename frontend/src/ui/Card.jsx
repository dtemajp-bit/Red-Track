export default function Card({ title, subtitle, action, children, style, className }) {
  return (
    <section
      className={className}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: 18,
        ...style,
      }}
    >
      {(title || action) && (
        <div className="rt-card-cab" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 style={{ fontSize: 15.5 }}>{title}</h2>}
            {subtitle && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
