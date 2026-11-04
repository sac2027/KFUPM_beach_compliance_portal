import { isWorstCase } from './worstCase';

/**
 * DEV ONLY. Plain, neutral chrome at the bottom centre; not part of the design under test.
 * Data is read at module load, so switching reloads the page with `?data=worst` (kept in the URL).
 */
export function WorstCaseToggle() {
  const worst = isWorstCase();
  const go = (next: 'demo' | 'worst') => {
    const url = new URL(location.href);
    if (next === 'worst') url.searchParams.set('data', 'worst');
    else url.searchParams.delete('data');
    location.assign(url);
  };
  const seg = (active: boolean): React.CSSProperties => ({
    font: '500 12px system-ui, sans-serif',
    padding: '6px 12px',
    border: 0,
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: '#222',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,.25)' : 'none',
  });
  return (
    <div
      data-dev-chrome
      role="group"
      aria-label="Data set"
      style={{ position: 'fixed', insetInline: 0, bottom: 12, margin: 'auto', inlineSize: 'fit-content', zIndex: 99999, display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: '#c9c9c9' }}
    >
      <button type="button" style={seg(!worst)} aria-pressed={!worst} onClick={() => go('demo')}>
        Demo data
      </button>
      <button type="button" style={seg(worst)} aria-pressed={worst} onClick={() => go('worst')}>
        Worst case
      </button>
    </div>
  );
}
