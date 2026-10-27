// =====================================================================
//  Kalendar za odabir datuma (isti izgled na iPhoneu i Androidu).
//  - hrvatski nazivi, tjedan počinje ponedjeljkom
//  - strelice za mjesec + izbornik mjeseca i godine
//  - godine: CALENDAR_FIRST_YEAR – CALENDAR_LAST_YEAR iz config.js
//  - svi dani u tom rasponu se mogu odabrati (i budući)
// =====================================================================
import { esc } from './ui.js';
import { CALENDAR_FIRST_YEAR, CALENDAR_LAST_YEAR } from './config.js';

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
  'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const MONTHS_GEN = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja',
  'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca'];
const WEEKDAYS = ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function todayISO() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}
function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** 2026-10-27 -> "27. listopada 2026." */
export function fmtLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${MONTHS_GEN[m - 1]} ${y}.`;
}

/**
 * Otvori kalendar.
 * @param {{ value: string, onPick: (iso: string) => void }} opts
 */
export function openCalendar({ value, onPick }) {
  // raspon godina (ako je postojeći datum izvan raspona, i ta godina se doda)
  const valueYear = value ? Number(value.slice(0, 4)) : null;
  const firstYear = Math.min(CALENDAR_FIRST_YEAR, valueYear ?? CALENDAR_FIRST_YEAR);
  const lastYear = Math.max(CALENDAR_LAST_YEAR, valueYear ?? CALENDAR_LAST_YEAR);
  const minISO = `${firstYear}-01-01`;
  const maxISO = `${lastYear}-12-31`;

  let start = value || todayISO();
  if (start < minISO) start = minISO;
  if (start > maxISO) start = maxISO;
  let [y, m] = start.split('-').map(Number);
  m -= 1;

  const wrap = document.createElement('div');
  wrap.className = 'dialog-backdrop';
  wrap.innerHTML = `<div class="dialog cal" role="dialog" aria-modal="true" aria-label="Odaberi datum"></div>`;
  const box = wrap.firstElementChild;

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
  };
  const pick = (iso) => {
    close();
    onPick(iso);
  };

  const render = () => {
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // ponedjeljak = 0
    const days = new Date(y, m + 1, 0).getDate();
    const today = todayISO();
    const atMin = y === firstYear && m === 0;
    const atMax = y === lastYear && m === 11;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span></span>');
    for (let d = 1; d <= days; d++) {
      const iso = toISO(y, m, d);
      const cls = [iso === value ? 'sel' : '', iso === today ? 'today' : ''].join(' ');
      cells.push(`<button type="button" class="day ${cls}" data-iso="${iso}"
        aria-label="${esc(fmtLong(iso))}" ${iso === value ? 'aria-current="date"' : ''}>${d}</button>`);
    }
    // uvijek 6 redova, da kalendar ne skače u visini
    while (cells.length < 42) cells.push('<span></span>');

    const years = [];
    for (let yy = firstYear; yy <= lastYear; yy++) years.push(yy);

    box.innerHTML = `
      <div class="cal-head">
        <button type="button" class="cal-arrow" data-nav="-1" aria-label="Prethodni mjesec" ${atMin ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <div class="cal-selects">
          <select id="cal-month" aria-label="Mjesec">
            ${MONTHS.map((name, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
          <select id="cal-year" aria-label="Godina">
            ${years.map((yy) => `<option value="${yy}" ${yy === y ? 'selected' : ''}>${yy}.</option>`).join('')}
          </select>
        </div>
        <button type="button" class="cal-arrow" data-nav="1" aria-label="Sljedeći mjesec" ${atMax ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="cal-grid cal-week">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="cal-quick">
        <button type="button" class="btn ghost" data-quick="0">Danas</button>
        <button type="button" class="btn ghost" data-quick="-1">Jučer</button>
        <button type="button" class="btn link-btn" data-close>Odustani</button>
      </div>`;

    box.querySelector('#cal-month').addEventListener('change', (e) => { m = Number(e.target.value); render(); });
    box.querySelector('#cal-year').addEventListener('change', (e) => { y = Number(e.target.value); render(); });
  };

  box.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      if (nav.disabled) return;
      m += Number(nav.dataset.nav);
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return render();
    }
    const day = e.target.closest('.day');
    if (day) return pick(day.dataset.iso);
    const quick = e.target.closest('[data-quick]');
    if (quick) return pick(shiftISO(todayISO(), Number(quick.dataset.quick)));
    if (e.target.closest('[data-close]')) close();
  });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey);

  render();
  document.body.appendChild(wrap);
}
