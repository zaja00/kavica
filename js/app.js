// =====================================================================
//  KAVICA – ekrani i logika
//  Ekrani: lozinka, kafići (početna), kafić, novi/uredi posjet,
//          uredi kafić, rang lista.
// =====================================================================
import { createDb, isDemo } from './db.js';
import { APP_NAME, CATEGORIES, FEATURES } from './config.js';
import { placeStats, visitOverall, fmt, tier } from './score.js';
import { esc, starsDisplay, starsInput, toast, debounce, askConfirm } from './ui.js';
import { mapsLink, locationSummary, locationFieldHTML, bindLocationField, locationChanged } from './location.js';
import { openCalendar, fmtLong, todayISO } from './calendar.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const view = $('#view');
const CAT_KEYS = CATEGORIES.map((c) => c.key);
const FEATURE_KEYS = FEATURES.map((f) => f.key);
const featureLabel = (key) => FEATURES.find((f) => f.key === key)?.label;
/** samo značajke koje postoje u config.js, u njihovom redoslijedu */
const featuresOf = (place) => FEATURE_KEYS.filter((k) => (place.tags || []).includes(k));

const state = {
  db: null,
  places: [],
  visits: [],
  stats: new Map(), // place_id -> placeStats
  unsubscribe: null,
};

// ---------------------------------------------------------------------
//  Podaci
// ---------------------------------------------------------------------
async function refresh() {
  const data = await state.db.loadAll();
  state.places = data.places;
  state.visits = data.visits;

  const byPlace = new Map();
  for (const v of state.visits) {
    if (!byPlace.has(v.place_id)) byPlace.set(v.place_id, []);
    byPlace.get(v.place_id).push(v);
  }
  state.stats = new Map();
  for (const p of state.places) {
    state.stats.set(p.id, placeStats(byPlace.get(p.id) || [], CAT_KEYS));
  }
}

const statsOf = (id) => state.stats.get(id) || placeStats([], CAT_KEYS);
const placeById = (id) => state.places.find((p) => p.id === id);
const overallOf = (visit) => visitOverall(visit, CAT_KEYS);

/** Svi do sad upisani gradovi (za prijedloge). */
function knownCities() {
  const set = new Map();
  for (const p of state.places) {
    const c = (p.city || '').trim();
    if (c && !set.has(c.toLowerCase())) set.set(c.toLowerCase(), c);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'hr'));
}

/** "danas", "jučer", "prije 5 dana", inače kratki datum */
function relDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - then) / 86400000);
  if (days === 0) return 'danas';
  if (days === 1) return 'jučer';
  if (days > 1 && days < 7) return `prije ${days} dana`;
  return `${d}. ${m}. ${y}.`;
}

function visitsWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} posjet`;
  return `${n} posjeta`;
}
function placesWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} kafić`;
  return `${n} kafića`;
}

// ---------------------------------------------------------------------
//  Favoriti (srce)
// ---------------------------------------------------------------------
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.7-7.6-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.5c0 5.7-7.6 10.4-7.6 10.4z"/></svg>';

function favButton(p, extraClass = '') {
  const on = !!p.favorite;
  return `<button type="button" class="fav ${extraClass} ${on ? 'on' : ''}" data-fav="${esc(p.id)}"
    aria-pressed="${on}" aria-label="${on ? 'Makni iz favorita' : 'Dodaj u favorite'}">${HEART}</button>`;
}

function paintFav(id, on) {
  $$(`.fav[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.classList.remove('pop');
    if (on) { void b.offsetWidth; b.classList.add('pop'); }
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Makni iz favorita' : 'Dodaj u favorite');
  });
}

async function toggleFavorite(id) {
  const p = placeById(id);
  if (!p) return;
  const next = !p.favorite;
  p.favorite = next;
  paintFav(id, next);
  if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* ništa */ } }
  if (!next && homeState.tab === 'fav' && renderHomeList) renderHomeList();
  try {
    await state.db.setFavorite(id, next);
  } catch (err) {
    p.favorite = !next;
    paintFav(id, !next);
    if (renderHomeList) renderHomeList();
    toast(err.message, 'error');
  }
}

// ---------------------------------------------------------------------
//  Prekidači "Što kafić ima" (ima / nema)
// ---------------------------------------------------------------------
function featureSwitches(selected = []) {
  return `<div class="switch-list">
    ${FEATURES.map((f) => {
      const on = selected.includes(f.key);
      return `<button type="button" class="switch-row" role="switch" aria-checked="${on}" data-feature="${esc(f.key)}">
        <span class="sw-text"><b>${esc(f.label)}</b><small>${esc(f.hint || '')}</small></span>
        <span class="sw" aria-hidden="true"><i></i></span>
      </button>`;
    }).join('')}
  </div>`;
}
function bindSwitches(root) {
  $$('.switch-row', root).forEach((row) =>
    row.addEventListener('click', () => {
      const on = row.getAttribute('aria-checked') !== 'true';
      row.setAttribute('aria-checked', String(on));
    })
  );
}
function setSwitches(root, selected) {
  $$('.switch-row', root).forEach((row) =>
    row.setAttribute('aria-checked', String(selected.includes(row.dataset.feature)))
  );
}
const readSwitches = (root) =>
  $$('.switch-row[aria-checked="true"]', root).map((r) => r.dataset.feature);

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Svi podaci kafića za spremanje (ostali tagovi koje config ne zna se čuvaju). */
function placePatch(place, changes) {
  const base = {
    name: place.name,
    city: place.city || null,
    address: place.address || null,
    maps_url: place.maps_url || null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    tags: place.tags || [],
  };
  const next = { ...base, ...changes };
  if (changes.features) {
    const keepOther = (place.tags || []).filter((t) => !FEATURE_KEYS.includes(t));
    next.tags = [...keepOther, ...changes.features];
    delete next.features;
  }
  return next;
}

// ---------------------------------------------------------------------
//  Usmjeravanje (hash)
// ---------------------------------------------------------------------
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

/** Gumb + u donjoj traci (kad si na kafiću, novi posjet ide tom kafiću). */
function setAddTarget(href) {
  $('#nav-add').href = href;
}

function setMode({ nav, form = false }) {
  $$('#nav a[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === nav));
  document.body.classList.toggle('form-mode', form);
}

let renderHomeList = null;

function closeOverlays() {
  $$('.dialog-backdrop').forEach((d) => d.remove());
}

async function route({ keepScroll = false } = {}) {
  const { parts, params } = parseHash();
  const [a, b] = parts;
  if (!keepScroll) { window.scrollTo(0, 0); closeOverlays(); }
  setAddTarget('#/add');
  renderHomeList = null;

  try {
    if (!a) { setMode({ nav: 'home' }); return viewHome(); }
    if (a === 'place' && b) { setMode({ nav: 'home' }); return viewPlace(b); }
    if (a === 'add') { setMode({ nav: '', form: true }); return viewVisitForm({ placeId: params.get('place') }); }
    if (a === 'visit' && b) { setMode({ nav: '', form: true }); return viewVisitForm({ visitId: b }); }
    if (a === 'place-edit' && b) { setMode({ nav: '', form: true }); return viewPlaceEdit(b); }
    if (a === 'ranking') { setMode({ nav: 'ranking' }); return viewRanking(); }
    location.hash = '#/';
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><p>Nešto je pošlo po zlu.</p><p class="muted">${esc(err.message)}</p></div>`;
  }
}

function isEditing() {
  return /^#\/(add|visit|place-edit)/.test(location.hash);
}

// ---------------------------------------------------------------------
//  Lozinka
// ---------------------------------------------------------------------
function showLock(message = '') {
  document.body.classList.add('locked');
  view.innerHTML = `
    <section class="lock">
      <img class="lock-logo" src="icons/cat-cream.png" alt="${esc(APP_NAME)}" width="132" height="119">
      <form id="lock-form" class="lock-form" novalidate>
        <label for="lock-pass">Lozinka</label>
        <input type="password" id="lock-pass" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" required>
        <p class="form-error" id="lock-error" role="alert">${esc(message)}</p>
        <button class="btn cream block" type="submit">Uđi</button>
        ${isDemo ? `<p class="lock-hint">Pregled: lozinka je kavica</p>` : ''}
      </form>
    </section>`;

  $('#lock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', e.target);
    btn.disabled = true;
    btn.textContent = 'Ulazim…';
    try {
      // mala/velika slova nisu bitna (mobitel često sam stavi veliko slovo)
      await state.db.unlock($('#lock-pass').value.trim().toLowerCase());
      await start();
    } catch (err) {
      $('#lock-error').textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Uđi';
    }
  });
}

// ---------------------------------------------------------------------
//  Ekran: kafići
// ---------------------------------------------------------------------
const MIN_SCORES = [
  { v: null, label: 'Sve' },
  { v: 3, label: '3+' },
  { v: 4, label: '4+' },
  { v: 4.5, label: '4,5+' },
];
const homeState = { q: '', tab: 'recent', minScore: null, feats: [] };

const filterCount = (f = homeState) => (f.minScore != null ? 1 : 0) + f.feats.length;

/** Kafići koji prolaze tražilicu, karticu (Nedavno/Favoriti) i filter. */
function filterPlaces(f = homeState) {
  const q = f.q.trim().toLowerCase();
  const items = state.places.filter((p) => {
    if (f.tab === 'fav' && !p.favorite) return false;
    if (f.minScore != null) {
      const o = statsOf(p.id).overall;
      if (o == null || o < f.minScore - 1e-9) return false;
    }
    const has = p.tags || [];
    if (!f.feats.every((k) => has.includes(k))) return false;
    if (!q) return true;
    return `${p.name} ${p.city || ''}`.toLowerCase().includes(q);
  });
  // Nedavno: zadnji posjet prvi (kafići bez posjeta po datumu dodavanja)
  const key = (p) => statsOf(p.id).lastVisit || (p.created_at || '').slice(0, 10);
  items.sort((a, b) => key(b).localeCompare(key(a)) || a.name.localeCompare(b.name, 'hr'));
  return items;
}

function viewHome() {
  if (!state.places.length) {
    view.innerHTML = `
      <div class="empty">
        <img src="icons/cat-brown.png" alt="" width="84" height="76">
        <h2>Još nema kafića</h2>
        <p class="muted">Kad sljedeći put popijete kavu negdje, dodajte prvi posjet.</p>
        <a class="btn primary" href="#/add">Dodaj prvi posjet</a>
      </div>`;
    return;
  }

  const lastVisit = state.visits[0];
  const lastPlace = lastVisit ? placeById(lastVisit.place_id) : null;

  view.innerHTML = `
    <div class="home-top">
      <div class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="q" type="search" placeholder="Traži kafić ili grad" value="${esc(homeState.q)}" autocomplete="off" enterkeyhint="search" aria-label="Traži">
      </div>
      <div class="home-controls">
        <div class="seg" id="tabs">
          <button data-tab="recent" class="${homeState.tab === 'recent' ? 'on' : ''}">Nedavno</button>
          <button data-tab="fav" class="tab-fav ${homeState.tab === 'fav' ? 'on' : ''}">${HEART}Favoriti</button>
        </div>
        <button type="button" class="filter-btn" id="open-filter" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          Filter<span class="filter-count" id="filter-count"></span>
        </button>
      </div>
      <div class="active-filters" id="active-filters"></div>
    </div>

    <div id="last-visit-slot">
    ${lastPlace ? `
      <a class="last-visit" href="#/place/${esc(lastPlace.id)}">
        <span class="lv-label">Zadnji posjet · ${esc(relDate(lastVisit.visit_date))}</span>
        <span class="lv-name">${esc(lastPlace.name)}</span>
        <span class="lv-score">${starsDisplay(overallOf(lastVisit), 'sm light')} ${fmt(overallOf(lastVisit))}</span>
      </a>` : ''}
    </div>

    <p class="list-meta" id="list-meta"></p>
    <div id="list" class="list"></div>`;

  const renderList = () => {
    const items = filterPlaces();
    const n = filterCount();
    const filtered = n > 0 || !!homeState.q.trim() || homeState.tab === 'fav';

    // zadnji posjet samo na čistom "Nedavno"
    $('#last-visit-slot').hidden = filtered;

    // gumb Filter + aktivni filteri kao oznake koje se mogu maknuti
    $('#filter-count').textContent = n ? String(n) : '';
    $('#open-filter').classList.toggle('active', n > 0);
    const pills = [];
    if (homeState.minScore != null) {
      pills.push(`<button type="button" class="pill" data-clear="score">Ocjena ${esc(MIN_SCORES.find((s) => s.v === homeState.minScore).label)}<span aria-hidden="true">×</span></button>`);
    }
    for (const k of homeState.feats) {
      pills.push(`<button type="button" class="pill" data-clear="${esc(k)}">${esc(featureLabel(k))}<span aria-hidden="true">×</span></button>`);
    }
    $('#active-filters').innerHTML = pills.join('');
    $('#active-filters').hidden = !pills.length;

    $('#list-meta').textContent = placesWord(items.length);
    let empty = 'Nijedan kafić ne odgovara. Probajte maknuti neki filter.';
    if (homeState.tab === 'fav' && !state.places.some((p) => p.favorite)) {
      empty = 'Još nemate favorita. Dodirnite srce na kafiću da ga dodate.';
    }
    $('#list').innerHTML = items.length
      ? items.map(placeCard).join('')
      : `<p class="muted center pad">${empty}</p>`;
  };
  renderHomeList = renderList;
  renderList();

  $('#q').addEventListener('input', debounce((e) => { homeState.q = e.target.value; renderList(); }));
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    homeState.tab = b.dataset.tab;
    $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderList();
  });
  $('#open-filter').addEventListener('click', () => openFilter(renderList));
  $('#active-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-clear]');
    if (!b) return;
    if (b.dataset.clear === 'score') homeState.minScore = null;
    else homeState.feats = homeState.feats.filter((k) => k !== b.dataset.clear);
    renderList();
  });
}

/** Ladica s filterom: minimalna ocjena + što kafić ima. */
function openFilter(onApply) {
  const draft = { ...homeState, feats: [...homeState.feats] };

  const wrap = document.createElement('div');
  wrap.className = 'dialog-backdrop';
  wrap.innerHTML = `
    <div class="dialog sheet filter-sheet" role="dialog" aria-modal="true" aria-label="Filter">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head">
        <h2>Filter</h2>
        <button type="button" class="link" data-act="clear">Očisti</button>
      </div>

      <h3 class="sheet-label">Ocjena</h3>
      <div class="seg" id="fl-score">
        ${MIN_SCORES.map((s) => `<button type="button" data-v="${s.v ?? ''}" class="${draft.minScore === s.v ? 'on' : ''}">${esc(s.label)}</button>`).join('')}
      </div>

      <h3 class="sheet-label">Kafić ima</h3>
      <div class="check-list" id="fl-feats">
        ${FEATURES.map((f) => `
          <button type="button" class="check-row" role="checkbox" aria-checked="${draft.feats.includes(f.key)}" data-k="${esc(f.key)}">
            <span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
            <span>${esc(f.label)}</span>
          </button>`).join('')}
      </div>

      <button type="button" class="btn primary block" data-act="apply" id="fl-apply"></button>
    </div>`;

  const sync = () => {
    $$('#fl-score button', wrap).forEach((b) => b.classList.toggle('on', (b.dataset.v === '' ? null : Number(b.dataset.v)) === draft.minScore));
    $$('#fl-feats .check-row', wrap).forEach((r) => r.setAttribute('aria-checked', String(draft.feats.includes(r.dataset.k))));
    const n = filterPlaces(draft).length;
    $('#fl-apply', wrap).textContent = n ? `Prikaži ${placesWord(n)}` : 'Nema takvih kafića';
  };

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) return close();
    const score = e.target.closest('#fl-score button');
    if (score) { draft.minScore = score.dataset.v === '' ? null : Number(score.dataset.v); return sync(); }
    const row = e.target.closest('.check-row');
    if (row) {
      const k = row.dataset.k;
      draft.feats = draft.feats.includes(k) ? draft.feats.filter((x) => x !== k) : [...draft.feats, k];
      return sync();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'clear') { draft.minScore = null; draft.feats = []; return sync(); }
    if (act === 'apply') {
      homeState.minScore = draft.minScore;
      homeState.feats = FEATURE_KEYS.filter((k) => draft.feats.includes(k));
      close();
      onApply();
    }
  });

  sync();
  document.body.appendChild(wrap);
}

function featureTags(p) {
  const f = featuresOf(p);
  return f.length ? `<span class="pc-tags">${f.map((k) => `<span class="tag">${esc(featureLabel(k))}</span>`).join('')}</span>` : '';
}

function placeCard(p) {
  const st = statsOf(p.id);
  const meta = [p.city, st.visitCount ? visitsWord(st.visitCount) : 'bez ocjene'].filter(Boolean).join(' · ');
  return `
    <div class="pcard">
      <a class="pc-link" href="#/place/${esc(p.id)}">
        <span class="thumb"><img src="icons/cat-cream.png" alt="" width="34" height="31"></span>
        <span class="pc-body">
          <span class="pc-name">${esc(p.name)}</span>
          <span class="pc-meta">${esc(meta)}${st.lastVisit ? ` · ${esc(relDate(st.lastVisit))}` : ''}</span>
          ${featureTags(p)}
        </span>
        <span class="badge tier-${tier(st.overall)}">
          <b>${fmt(st.overall)}</b>
          ${starsDisplay(st.overall, 'xs')}
        </span>
      </a>
      ${favButton(p, 'on-card')}
    </div>`;
}

// ---------------------------------------------------------------------
//  Ekran: jedan kafić
// ---------------------------------------------------------------------
function viewPlace(id) {
  const p = placeById(id);
  if (!p) {
    view.innerHTML = `<div class="empty"><p>Taj kafić više ne postoji.</p><a class="btn primary" href="#/">Natrag na kafiće</a></div>`;
    return;
  }
  setAddTarget(`#/add?place=${encodeURIComponent(id)}`);

  const st = statsOf(id);
  const rated = CATEGORIES.filter((c) => st.cats[c.key] != null);
  const visits = state.visits.filter((v) => v.place_id === id);

  view.innerHTML = `
    <div class="place-top">
      <a class="back" href="#/">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Kafići
      </a>
      ${favButton(p, 'big')}
    </div>

    <section class="place-head">
      <div class="ph-text">
        <h1>${esc(p.name)}</h1>
        <p class="muted">${esc([p.city, visitsWord(st.visitCount)].filter(Boolean).join(' · '))}</p>
        ${locationSummary(p) ? `<p class="loc-line">${esc(locationSummary(p))}</p>` : ''}
        ${featureTags(p)}
      </div>
      <div class="badge big tier-${tier(st.overall)}">
        <b>${fmt(st.overall)}</b>
        ${starsDisplay(st.overall, 'xs')}
      </div>
    </section>

    <div class="quick-actions">
      <a class="qa" href="${esc(mapsLink(p))}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>
        Karta
      </a>
      <a class="qa" href="#/place-edit/${esc(p.id)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>
        Uredi kafić
      </a>
      <a class="qa primary" href="#/add?place=${encodeURIComponent(p.id)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        Novi posjet
      </a>
    </div>

    ${rated.length ? `
    <section class="cat-card">
      <h2 class="section-title">Ocjene</h2>
      <ul class="bars">
        ${rated.map((c) => {
          const v = st.cats[c.key];
          return `<li>
            <span class="bar-label">${esc(c.label)}</span>
            <span class="bar"><i style="width:${(v / 5) * 100}%"></i></span>
            <b class="bar-val">${fmt(v)}</b>
          </li>`;
        }).join('')}
      </ul>
    </section>` : ''}

    <h2 class="section-title">Posjeti</h2>
    ${visits.length ? `<div class="visits">${visits.map(visitCard).join('')}</div>`
      : `<p class="muted">Još nema posjeta. Dodajte prvi gumbom „Novi posjet”.</p>`}
  `;

  $$('[data-del]', view).forEach((btn) =>
    btn.addEventListener('click', async () => {
      const v = state.visits.find((x) => x.id === btn.dataset.del);
      if (!v) return;
      if (!(await askConfirm(`Obrisati posjet od ${fmtLong(v.visit_date)}?`, { ok: 'Obriši', danger: true }))) return;
      try {
        await state.db.deleteVisit(v);
        await refresh();
        toast('Posjet je obrisan');
        viewPlace(id);
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

function visitCard(v) {
  const ov = overallOf(v);
  const chips = CATEGORIES
    .filter((c) => v.ratings?.[c.key] != null)
    .map((c) => `<li><span>${esc(c.label)}</span><b>${esc(v.ratings[c.key])}</b></li>`)
    .join('');
  return `
    <article class="visit">
      <header>
        <span class="v-date">${esc(fmtLong(v.visit_date))}</span>
        <span class="v-score">${starsDisplay(ov, 'sm')}<b>${fmt(ov)}</b></span>
      </header>
      ${chips ? `<ul class="rchips">${chips}</ul>` : ''}
      <footer>
        <a href="#/visit/${esc(v.id)}">Uredi</a>
        <button type="button" class="link danger" data-del="${esc(v.id)}">Obriši</button>
      </footer>
    </article>`;
}

// ---------------------------------------------------------------------
//  Zajednički dijelovi formi
// ---------------------------------------------------------------------
function rateRow(c, value) {
  return `<div class="rate-row">
    <div class="rate-label"><b>${esc(c.label)}</b><small>${esc(c.hint || '')}</small></div>
    ${starsInput(c.key, value)}
  </div>`;
}

function formHeader(title, backHref) {
  return `
    <div class="form-head">
      <a class="icon-btn" href="${backHref}" aria-label="Odustani">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </a>
      <h1>${esc(title)}</h1>
      <span class="icon-btn-spacer"></span>
    </div>`;
}

function citiesDatalist() {
  return `<datalist id="cities-dl">${knownCities().map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>`;
}

// ---------------------------------------------------------------------
//  Ekran: novi / uredi posjet
// ---------------------------------------------------------------------
function viewVisitForm({ placeId, visitId }) {
  const editing = visitId ? state.visits.find((v) => v.id === visitId) : null;
  if (visitId && !editing) {
    view.innerHTML = `<div class="empty"><p>Taj posjet više ne postoji.</p><a class="btn primary" href="#/">Natrag</a></div>`;
    return;
  }
  const lockedPlace = editing ? placeById(editing.place_id) : placeId ? placeById(placeId) : null;
  if ((editing || placeId) && !lockedPlace) {
    view.innerHTML = `<div class="empty"><p>Kafić nije pronađen.</p><a class="btn primary" href="#/">Natrag</a></div>`;
    return;
  }

  const ratings = {};
  for (const k of CAT_KEYS) if (editing?.ratings?.[k] != null) ratings[k] = editing.ratings[k];
  let date = editing?.visit_date || todayISO();
  const back = lockedPlace ? `#/place/${lockedPlace.id}` : '#/';

  view.innerHTML = `
    ${formHeader(editing ? 'Uredi posjet' : 'Novi posjet', back)}
    <form id="f" class="form" novalidate>
      ${lockedPlace ? `
        <div class="locked-place">
          <span class="muted small">Kafić</span>
          <b>${esc(lockedPlace.name)}</b>
        </div>` : `
        <label for="f-name">Kafić</label>
        <input id="f-name" list="places-dl" autocomplete="off" autocapitalize="words" placeholder="Npr. Kavana Mali Mir" required>
        <datalist id="places-dl">${state.places.map((p) => `<option value="${esc(p.name)}">${esc(p.city || '')}</option>`).join('')}</datalist>
        <div id="pick-wrap" hidden>
          <label for="f-pick">Koji od njih?</label>
          <select id="f-pick"></select>
        </div>
        <p class="hint-line" id="place-hint"></p>`}

      <label for="f-city">Grad</label>
      <input id="f-city" list="cities-dl" autocomplete="off" autocapitalize="words" placeholder="Npr. Split" value="${esc(lockedPlace?.city || '')}">
      ${citiesDatalist()}

      <span class="label-text">Lokacija</span>
      ${locationFieldHTML('f')}

      <span class="label-text">Datum posjeta</span>
      <button type="button" class="date-field" id="f-date">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
        <span id="f-date-text"></span>
      </button>

      <div class="rate-head">
        <span class="label-text">Ocjene</span>
        <span class="live-score" id="live-score"></span>
      </div>
      <div class="rate-list">${CATEGORIES.map((c) => rateRow(c, ratings[c.key])).join('')}</div>
      <p class="hint-line">Ocijenite samo ono što želite. Dodir na istu zvjezdicu briše ocjenu.</p>

      <span class="label-text">Što kafić ima</span>
      <div id="f-features">${featureSwitches(lockedPlace ? featuresOf(lockedPlace) : [])}</div>

      <p class="form-error" id="f-error" role="alert"></p>
      <div class="save-bar">
        <button class="btn primary block" id="f-save" type="submit">Spremi posjet</button>
      </div>
    </form>`;

  const form = $('#f');
  bindSwitches(form);
  const loc = bindLocationField(form, 'f', lockedPlace);

  // ---- datum (kalendar) ----
  const paintDate = () => {
    const rel = relDate(date);
    $('#f-date-text').innerHTML = `${esc(fmtLong(date))}${rel === 'danas' || rel === 'jučer' ? ` <small>${rel}</small>` : ''}`;
  };
  paintDate();
  $('#f-date').addEventListener('click', () =>
    openCalendar({ value: date, onPick: (iso) => { date = iso; paintDate(); } })
  );

  // ---- odabir kafića: postojeći ili novi ----
  let chosenPlace = lockedPlace || null;
  const nameInput = $('#f-name');
  const applyPlace = (p) => {
    // kad se prepozna postojeći kafić, popuni njegov grad i što ima
    $('#f-city').value = p?.city || '';
    setSwitches(form, p ? featuresOf(p) : []);
    loc.set(p);
  };
  const syncPlace = () => {
    if (lockedPlace) return;
    const typed = nameInput.value.trim().toLowerCase();
    const matches = typed ? state.places.filter((p) => p.name.trim().toLowerCase() === typed) : [];
    const before = chosenPlace;
    const pickWrap = $('#pick-wrap');
    if (matches.length > 1) {
      pickWrap.hidden = false;
      $('#f-pick').innerHTML = matches.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.city ? ' – ' + esc(p.city) : ''}</option>`).join('');
      if (!matches.includes(chosenPlace)) chosenPlace = matches[0];
      $('#f-pick').value = chosenPlace.id;
      $('#f-pick').onchange = (e) => { chosenPlace = placeById(e.target.value); applyPlace(chosenPlace); };
    } else {
      pickWrap.hidden = true;
      chosenPlace = matches[0] || null;
    }
    if (chosenPlace !== before) applyPlace(chosenPlace);
    $('#place-hint').textContent = chosenPlace
      ? 'Ovaj kafić već postoji, posjet se dodaje njemu.'
      : typed ? 'Novi kafić.' : '';
  };
  nameInput?.addEventListener('input', syncPlace);

  // ---- zvjezdice + ocjena uživo ----
  const updateLive = () => {
    const vals = Object.values(ratings);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    $('#live-score').innerHTML = avg == null ? '' : `${starsDisplay(avg, 'sm')} <b>${fmt(avg)}</b>`;
  };
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;
    const box = btn.closest('.star-input');
    const key = box.dataset.key;
    const n = Number(btn.dataset.n);
    if (ratings[key] === n) delete ratings[key];
    else ratings[key] = n;
    $$('.star-btn', box).forEach((b) => {
      const on = ratings[key] != null && Number(b.dataset.n) <= ratings[key];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(Number(b.dataset.n) === ratings[key]));
    });
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* ništa */ } }
    updateLive();
  });
  updateLive();

  // ---- spremanje ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#f-error');
    errEl.textContent = '';
    const name = lockedPlace ? lockedPlace.name : nameInput.value.trim();
    const city = $('#f-city').value.trim();
    const feats = readSwitches(form);
    const where = loc.get();
    if (!name) { errEl.textContent = 'Upišite naziv kafića.'; nameInput?.focus(); return; }
    if (!Object.keys(ratings).length) { errEl.textContent = 'Ocijenite barem jednu kategoriju.'; return; }

    if (!editing && chosenPlace) {
      const dup = state.visits.find((v) => v.place_id === chosenPlace.id && v.visit_date === date);
      if (dup && (await askConfirm('Za taj dan već postoji posjet ovog kafića. Želite li urediti njega?', { ok: 'Uredi postojeći', cancel: 'Dodaj novi' }))) {
        location.hash = `#/visit/${dup.id}`;
        return;
      }
    }

    const btn = $('#f-save');
    btn.disabled = true;
    btn.textContent = 'Spremam…';
    try {
      let place = chosenPlace;
      if (!place) {
        place = await state.db.createPlace({ name, city: city || null, tags: feats, ...where });
      } else if ((place.city || '') !== city || !sameSet(featuresOf(place), feats) || locationChanged(place, where)) {
        // grad, lokacija ili "što ima" su promijenjeni -> spremi uz kafić (vidi i ona)
        await state.db.updatePlace(place.id, placePatch(place, { city: city || null, features: feats, ...where }));
      }

      const payload = { place_id: place.id, visit_date: date, ratings: { ...ratings } };
      if (editing) await state.db.updateVisit(editing.id, payload);
      else await state.db.createVisit(payload);

      await refresh();
      toast('Spremljeno');
      location.hash = `#/place/${place.id}`;
    } catch (err) {
      console.error(err);
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Spremi posjet';
    }
  });
}

// ---------------------------------------------------------------------
//  Ekran: uredi kafić
// ---------------------------------------------------------------------
function viewPlaceEdit(id) {
  const p = placeById(id);
  if (!p) {
    view.innerHTML = `<div class="empty"><p>Kafić nije pronađen.</p><a class="btn primary" href="#/">Natrag</a></div>`;
    return;
  }

  view.innerHTML = `
    ${formHeader('Uredi kafić', `#/place/${p.id}`)}
    <form id="pf" class="form" novalidate>
      <label for="p-name">Naziv</label>
      <input id="p-name" value="${esc(p.name)}" autocapitalize="words" required>
      <label for="p-city">Grad</label>
      <input id="p-city" list="cities-dl" value="${esc(p.city || '')}" autocapitalize="words" autocomplete="off" placeholder="Npr. Split">
      ${citiesDatalist()}
      <span class="label-text">Lokacija</span>
      ${locationFieldHTML('p')}
      <span class="label-text">Što kafić ima</span>
      ${featureSwitches(featuresOf(p))}
      <p class="form-error" id="p-error" role="alert"></p>
      <button class="btn ghost danger block" type="button" id="p-del">Obriši kafić</button>
      <div class="save-bar">
        <button class="btn primary block" type="submit">Spremi</button>
      </div>
    </form>`;

  const form = $('#pf');
  bindSwitches(form);
  const loc = bindLocationField(form, 'p', p);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#p-name').value.trim();
    const err = $('#p-error');
    if (!name) { err.textContent = 'Naziv ne može biti prazan.'; return; }
    try {
      await state.db.updatePlace(id, placePatch(p, {
        name, city: $('#p-city').value.trim() || null, features: readSwitches(form), ...loc.get(),
      }));
      await refresh();
      toast('Spremljeno');
      location.hash = `#/place/${id}`;
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  $('#p-del').addEventListener('click', async () => {
    const n = statsOf(id).visitCount;
    const msg = n
      ? `Obrisati „${p.name}” i ${visitsWord(n)} s ocjenama? To se ne može vratiti.`
      : `Obrisati „${p.name}”?`;
    if (!(await askConfirm(msg, { ok: 'Obriši', danger: true }))) return;
    try {
      await state.db.deletePlace(id);
      await refresh();
      toast('Kafić je obrisan');
      location.hash = '#/';
    } catch (ex) {
      toast(ex.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------
//  Ekran: rang lista
// ---------------------------------------------------------------------
function viewRanking() {
  const rows = state.places
    .map((p) => ({ p, st: statsOf(p.id) }))
    .filter((x) => x.st.overall != null)
    .sort((a, b) =>
      b.st.overall - a.st.overall ||
      b.st.visitCount - a.st.visitCount ||
      a.p.name.localeCompare(b.p.name, 'hr'));

  view.innerHTML = `
    <h1 class="page-title">Rang lista</h1>
    <ol class="rank">
      ${rows.length ? rows.map((x, i) => `
        <li>
          <a class="rank-row ${i < 3 ? 'top top' + (i + 1) : ''}" href="#/place/${esc(x.p.id)}">
            <span class="pos">${i + 1}</span>
            <span class="rname">
              <b>${esc(x.p.name)}${x.p.favorite ? ` <span class="mini-heart" aria-label="favorit">${HEART}</span>` : ''}</b>
              <small>${esc([x.p.city, visitsWord(x.st.visitCount)].filter(Boolean).join(' · '))}</small>
            </span>
            <span class="rval">
              <b>${fmt(x.st.overall)}</b>
              ${starsDisplay(x.st.overall, 'xs')}
            </span>
          </a>
        </li>`).join('')
      : `<li class="muted center pad">Još nema ocijenjenih kafića. Dodajte prvi posjet gumbom +.</li>`}
    </ol>`;
}

// ---------------------------------------------------------------------
//  Pokretanje i sinkronizacija
// ---------------------------------------------------------------------
const liveRefresh = debounce(async () => {
  try {
    await refresh();
    // ne prekidaj unos ni otvoreni filter/kalendar
    if (!isEditing() && !$('.dialog-backdrop')) route({ keepScroll: true });
  } catch (err) {
    if (err.authExpired) relock();
    // inače tiho: sljedeći pokušaj za 30 s ili kad se aplikacija ponovno otvori
  }
}, 400);

/** Prijava je istekla -> natrag na lozinku. */
async function relock() {
  state.unsubscribe?.();
  state.unsubscribe = null;
  try { await state.db.lock(); } catch { /* ništa */ }
  closeOverlays();
  showLock('Prijava je istekla. Upiši lozinku ponovno.');
}

async function start() {
  document.body.classList.remove('locked');
  $('#demo-banner').hidden = !isDemo;
  try {
    await refresh();
  } catch (err) {
    console.error(err);
    if (err.authExpired) return relock();
    view.innerHTML = `<div class="empty">
      <h2>Podaci se ne mogu učitati</h2>
      <p class="muted">${esc(err.message)}</p>
      <button type="button" class="btn primary" id="retry">Pokušaj ponovno</button>
    </div>`;
    $('#retry').addEventListener('click', () => start());
    return;
  }
  state.unsubscribe?.();
  state.unsubscribe = state.db.subscribe(liveRefresh);
  route();
}

async function boot() {
  document.title = APP_NAME;

  // srce (favorit) bilo gdje u aplikaciji
  view.addEventListener('click', (e) => {
    const fav = e.target.closest('.fav[data-fav]');
    if (!fav) return;
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(fav.dataset.fav);
  });

  try {
    state.db = await createDb();
  } catch (err) {
    view.innerHTML = `<div class="empty"><h2>Pokretanje nije uspjelo</h2><p class="muted">${esc(err.message)}</p></div>`;
    return;
  }

  window.addEventListener('hashchange', () => {
    if (!document.body.classList.contains('locked')) route();
  });

  // kad se vratiš u aplikaciju, povuci svježe podatke
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !document.body.classList.contains('locked')) liveRefresh();
  });

  if (!(await state.db.isUnlocked())) return showLock();
  await start();
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
