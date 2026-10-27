// =====================================================================
//  Male pomoćne funkcije za sučelje
// =====================================================================
import { MAX_STARS } from './config.js';
import { fmt } from './score.js';

/** Escape za sve što je upisao korisnik prije ubacivanja u HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- zvjezdice (prikaz) ----------------------------------------------
const STAR_PATH =
  'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

function starSvg(cls) {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
}

/** Prikaz ocjene kao zvjezdice s djelomičnim punjenjem (npr. 4,3). */
export function starsDisplay(value, size = '') {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / MAX_STARS) * 100));
  const row = Array.from({ length: MAX_STARS }, () => starSvg('star')).join('');
  return `<span class="stars ${size}" role="img" aria-label="${value == null ? 'bez ocjene' : fmt(value) + ' od ' + MAX_STARS}">
    <span class="stars-off">${row}</span>
    <span class="stars-on" style="width:${pct}%">${row}</span>
  </span>`;
}

/** Zvjezdice za unos (pet gumba). Klik na istu vrijednost briše ocjenu. */
export function starsInput(key, value) {
  return `<div class="star-input" data-key="${esc(key)}" data-value="${value ?? ''}" role="radiogroup">
    ${Array.from({ length: MAX_STARS }, (_, i) => {
      const n = i + 1;
      const on = value != null && n <= value;
      return `<button type="button" class="star-btn ${on ? 'on' : ''}" data-n="${n}" role="radio" aria-checked="${value === n}" aria-label="${n} od ${MAX_STARS}">${starSvg('star')}</button>`;
    }).join('')}
  </div>`;
}

// ---- obavijesti ---------------------------------------------------------
let toastTimer;
export function toast(message, kind = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

// ---- potvrda (vlastiti dijalog umjesto confirm()) -------------------------
/** Vraća Promise<boolean>. */
export function askConfirm(message, { ok = 'Da', cancel = 'Odustani', danger = false } = {}) {
  return new Promise((resolve) => {
    document.querySelector('.dialog-backdrop')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'dialog-backdrop';
    wrap.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <p id="dlg-msg">${esc(message)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" data-v="0">${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? 'danger-solid' : 'primary'}" data-v="1">${esc(ok)}</button>
        </div>
      </div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return done(false);
      const b = e.target.closest('button[data-v]');
      if (b) done(b.dataset.v === '1');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('button[data-v="1"]').focus();
  });
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
