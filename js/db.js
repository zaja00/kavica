// =====================================================================
//  Sloj za podatke. Aplikacija priča samo s ovim sučeljem, a postoje
//  dvije implementacije:
//   - Supabase (prava baza, sinkronizacija odmah između mobitela)
//   - Demo (sve u ovom pregledniku, za isprobavanje bez računa)
//  Demo se uključuje sam dok config.js nije popunjen, ili s ?demo u linku.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY, SHARED_EMAIL } from './config.js';

const configured =
  SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT') &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');

let wantsDemo = false;
try { wantsDemo = new URLSearchParams(location.search).has('demo'); } catch { /* ništa */ }

export const isDemo = wantsDemo || !configured;

export async function createDb() {
  if (isDemo) {
    const { createDemoDb } = await import('./db-demo.js');
    return createDemoDb();
  }
  return createSupabaseDb();
}

/** Samo stupci koje tablica places ima (ništa drugo ne ide u bazu). */
export function placeRow(p) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v, max) => {
    const t = (v ?? '').toString().trim();
    return t ? t.slice(0, max) : null;
  };
  return {
    name: str(p.name, 120) || 'Bez imena',
    city: str(p.city, 80),
    address: str(p.address, 200),
    maps_url: str(p.maps_url, 500),
    lat: num(p.lat),
    lng: num(p.lng),
    tags: Array.isArray(p.tags) ? [...new Set(p.tags.map(String))] : [],
  };
}

/** Prijevod grešaka na razumljiv hrvatski. */
export function friendlyError(error) {
  const msg = (error && (error.message || error.error_description || error.msg)) || String(error || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'Nema interneta ili baza ne odgovara. Provjeri vezu i pokušaj ponovno.';
  }
  if (/jwt|token|not authenticated|401/i.test(msg)) {
    return 'Prijava je istekla. Upiši lozinku ponovno.';
  }
  if (/row-level security|permission denied|42501/i.test(msg)) {
    return 'Baza nije dopustila promjenu. Provjeri je li pokrenut supabase/schema.sql.';
  }
  if (/does not exist|relation|schema cache|PGRST/i.test(msg)) {
    return 'Tablice u bazi ne postoje ili su stare. Pokreni supabase/schema.sql u Supabaseu.';
  }
  return msg || 'Nešto je pošlo po zlu.';
}

// ---------------------------------------------------------------------
//  Supabase
// ---------------------------------------------------------------------
async function createSupabaseDb() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'kavica-auth' },
  });

  const fail = (error) => {
    if (error) {
      const e = new Error(friendlyError(error));
      e.authExpired = /jwt|token|not authenticated|401/i.test(error.message || '');
      throw e;
    }
  };

  return {
    mode: 'supabase',

    // ---- zajednička lozinka ----
    async isUnlocked() {
      const { data } = await sb.auth.getSession();
      return !!data.session;
    },
    async unlock(password) {
      const { error } = await sb.auth.signInWithPassword({ email: SHARED_EMAIL, password });
      if (error) {
        if (/invalid login|invalid credentials/i.test(error.message)) throw new Error('Kriva lozinka.');
        if (/email not confirmed/i.test(error.message)) throw new Error('Račun nije potvrđen. U Supabaseu uključi "Auto Confirm User" (vidi upute).');
        throw new Error(friendlyError(error));
      }
    },
    async lock() {
      await sb.auth.signOut();
    },

    // ---- čitanje ----
    // Supabase vraća najviše 1000 redova po upitu, pa čitamo u dijelovima
    // (inače bi se nakon 1000 posjeta stariji posjeti "izgubili" iz prikaza).
    async loadAll() {
      const PAGE = 1000;
      const readAll = async (makeQuery) => {
        const rows = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await makeQuery().range(from, from + PAGE - 1);
          fail(error);
          rows.push(...(data || []));
          if (!data || data.length < PAGE) return rows;
        }
      };
      const [places, visits] = await Promise.all([
        readAll(() => sb.from('places').select('*').order('name').order('id')),
        readAll(() => sb.from('visits').select('*')
          .order('visit_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')),
      ]);
      return { places, visits };
    },

    /**
     * Poziva cb() kad bilo tko promijeni podatke (uživo).
     * Rezerva: dok je aplikacija otvorena, svakih 30 s provjeri ima li novog,
     * za slučaj da veza uživo pukne (slab signal, mobitel štedi bateriju...).
     */
    subscribe(cb) {
      const ch = sb
        .channel('kavica-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, () => cb())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => cb())
        .subscribe();
      const timer = setInterval(() => {
        if (!document.hidden) cb();
      }, 30_000);
      return () => {
        clearInterval(timer);
        sb.removeChannel(ch);
      };
    },

    // ---- kafići ----
    async createPlace(p) {
      const { data, error } = await sb
        .from('places')
        .insert({ ...placeRow(p), favorite: false })
        .select()
        .single();
      fail(error);
      return data;
    },
    async updatePlace(id, p) {
      const { error } = await sb.from('places').update(placeRow(p)).eq('id', id);
      fail(error);
    },
    async setFavorite(id, favorite) {
      const { error } = await sb.from('places').update({ favorite: !!favorite }).eq('id', id);
      fail(error);
    },
    async deletePlace(id) {
      // posjeti se brišu sami (on delete cascade u bazi)
      const { error } = await sb.from('places').delete().eq('id', id);
      fail(error);
    },

    // ---- posjeti ----
    async createVisit(v) {
      const { data, error } = await sb
        .from('visits')
        .insert({ place_id: v.place_id, visit_date: v.visit_date, ratings: v.ratings })
        .select()
        .single();
      fail(error);
      return data;
    },
    async updateVisit(id, v) {
      const { error } = await sb
        .from('visits')
        .update({ visit_date: v.visit_date, ratings: v.ratings })
        .eq('id', id);
      fail(error);
    },
    async deleteVisit(visit) {
      const { error } = await sb.from('visits').delete().eq('id', visit.id);
      fail(error);
    },
  };
}
