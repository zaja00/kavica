// =====================================================================
//  DEMO baza – sve se sprema u ovaj preglednik (localStorage).
//  Služi samo za isprobavanje izgleda i toka bez Supabasea.
//  Lozinka u demu: kavica
// =====================================================================
import { placeRow } from './db.js';

const KEY = 'kavica-demo-v5';
const UNLOCK_KEY = 'kavica-demo-unlocked-v2';
const DEMO_PASSWORD = 'kavica';

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* nema spremanja */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* ništa */ } }

let memory = null;         // rezerva ako localStorage ne radi
let unlockedInMemory = false;

const uid = () => 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function seed() {
  const iso = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const place = (id, name, city, tags, daysAgo, favorite = false, extra = {}) => ({
    id, ...placeRow({ name, city, tags, ...extra }), favorite, created_at: iso(daysAgo) + 'T09:00:00Z',
  });
  const visit = (id, placeId, daysAgo, ratings) => ({
    id, place_id: placeId, visit_date: iso(daysAgo), ratings, created_at: iso(daysAgo) + 'T10:00:00Z',
  });
  return {
    places: [
      place('p1', 'Kavana Mali Mir', 'Split', ['vani', 'unutra', 'tiho'], 40, true, { lat: 43.508133, lng: 16.440193 }),
      place('p2', 'Bar Riva', 'Split', ['vani', 'more'], 25, false, { address: 'Obala Hrvatskog narodnog preporoda' }),
      place('p3', 'Caffe Pod Murvom', 'Trogir', ['vani', 'parking'], 12),
      place('p4', 'Kava Kutak', 'Split', ['unutra', 'tiho'], 4),
    ],
    visits: [
      visit('v1', 'p1', 40, { kava: 5, ambijent: 4, usluga: 4, cijena: 4, uredenje: 5 }),
      visit('v2', 'p1', 9, { kava: 5, ambijent: 5, usluga: 5, cijena: 4, uredenje: 5 }),
      visit('v3', 'p2', 25, { kava: 3, ambijent: 5, lokacija: 5, cijena: 2 }),
      visit('v4', 'p3', 12, { kava: 4, ambijent: 4, usluga: 3, lokacija: 3 }),
      visit('v5', 'p4', 4, { kava: 4, ambijent: 4, usluga: 5, cijena: 5, uredenje: 3 }),
    ],
  };
}

function load() {
  try {
    const raw = lsGet(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignoriraj */ }
  if (memory) return memory;
  const s = seed();
  save(s);
  return s;
}
function save(state) {
  memory = state;
  lsSet(KEY, JSON.stringify(state));
}

export function createDemoDb() {
  return {
    mode: 'demo',

    async isUnlocked() {
      return unlockedInMemory || lsGet(UNLOCK_KEY) === '1';
    },
    async unlock(password) {
      if (!password) throw new Error('Upiši lozinku.');
      if (password !== DEMO_PASSWORD) throw new Error('Kriva lozinka.');
      unlockedInMemory = true;
      lsSet(UNLOCK_KEY, '1');
    },
    async lock() {
      unlockedInMemory = false;
      lsDel(UNLOCK_KEY);
    },
    /** samo za demo */
    async demoReset() {
      lsDel(KEY);
      memory = null;
    },

    async loadAll() {
      const s = load();
      return {
        places: [...s.places].sort((a, b) => a.name.localeCompare(b.name, 'hr')),
        visits: [...s.visits].sort((a, b) =>
          (b.visit_date + b.created_at).localeCompare(a.visit_date + a.created_at)
        ),
      };
    },

    // promjene iz druge kartice istog preglednika (kao "sinkronizacija")
    subscribe(cb) {
      const onStorage = (e) => { if (e.key === KEY) cb(); };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },

    async createPlace(p) {
      const s = load();
      const row = { id: uid(), ...placeRow(p), favorite: false, created_at: new Date().toISOString() };
      s.places.push(row);
      save(s);
      return row;
    },
    async updatePlace(id, p) {
      const s = load();
      const row = s.places.find((x) => x.id === id);
      if (row) Object.assign(row, placeRow(p));
      save(s);
    },
    async setFavorite(id, favorite) {
      const s = load();
      const row = s.places.find((x) => x.id === id);
      if (row) row.favorite = !!favorite;
      save(s);
    },
    async deletePlace(id) {
      const s = load();
      s.places = s.places.filter((x) => x.id !== id);
      s.visits = s.visits.filter((x) => x.place_id !== id);
      save(s);
    },

    async createVisit(v) {
      const s = load();
      const row = {
        id: uid(), place_id: v.place_id, visit_date: v.visit_date, ratings: v.ratings,
        created_at: new Date().toISOString(),
      };
      s.visits.push(row);
      save(s);
      return row;
    },
    async updateVisit(id, v) {
      const s = load();
      const row = s.visits.find((x) => x.id === id);
      if (row) Object.assign(row, { visit_date: v.visit_date, ratings: v.ratings });
      save(s);
    },
    async deleteVisit(visit) {
      const s = load();
      s.visits = s.visits.filter((x) => x.id !== visit.id);
      save(s);
    },
  };
}
