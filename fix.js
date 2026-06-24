const fs = require('fs');
let css = fs.readFileSync('src/app/styles/user-profile.css', 'utf8');
const lines = css.split('\n');

// The corrupted duplicate block spans from line 120 to 259.
// Lines 118-121 in the corrupted file:
// 118: .upf-username {
// 119:   font-size: 0.85rem;
// 120: /* ═══════════════════════════════════════════════════════════════════════════

css = [
  ...lines.slice(0, 117), // up to line 117
  '.upf-username {',
  '  font-size: 0.85rem;',
  '  color: var(--text-muted);',
  '  margin-top: 2px;',
  '}',
  '',
  '/* ── Role / Location / Bio ───────────────────────────────────────────────── */',
  '.upf-role-badge {',
  '  display: inline-flex;',
  '  align-items: center;',
  '  gap: 5px;',
  '  font-size: 0.72rem;',
  '  font-weight: 700;',
  '  color: var(--text-muted);',
  '  background: rgba(255, 255, 255, 0.05);',
  '  border: 1px solid var(--border-color);',
  '  padding: 3px 10px;',
  '  border-radius: 20px;',
  '  width: fit-content;',
  '}',
  '',
  '.upf-location {',
  '  display: flex;',
  '  align-items: center;',
  '  gap: 5px;',
  '  font-size: 0.8rem;',
  '  color: var(--text-muted);',
  '}',
  ...lines.slice(259) // line 260 onwards
].join('\n');

fs.writeFileSync('src/app/styles/user-profile.css', css);
console.log('Fixed user-profile.css');
