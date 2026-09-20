export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5c-4.7 0-8 3.6-8 8.3 0 6.2-2.6 8.2-2.6 8.2h21.2S24 18 24 11.8c0-4.7-3.3-8.3-8-8.3Z" fill="#F0A02A"/><path d="M12.8 22.6h6.4a3.2 3.2 0 0 1-6.4 0Z" fill="#F0A02A"/><path d="m11.6 12.6 3.2 3.2 5.8-6.2" stroke="#0B4A30" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>{!compact && <div><strong>AbisoTrack</strong><small>Every alert, accounted for.</small></div>}</div>;
}
