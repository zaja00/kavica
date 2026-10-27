// =====================================================================
//  Lokacija kafića
//  - GPS: gumb "Spremi lokaciju" (radi na iPhoneu i Androidu, traži
//    dozvolu jednom; treba https, a GitHub Pages je https)
//  - ili jedno polje: zalijepi link s Google Mapsa ILI upiši adresu
//  - Karta otvara najtočnije što postoji: GPS > link > adresa > naziv+grad
// =====================================================================
import { esc } from './ui.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Ima li kafić spremljene GPS koordinate? */
export const hasGps = (p) => isNum(p?.lat) && isNum(p?.lng);

/** Dopušta samo http(s) linkove. */
export function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const MAP_HOSTS = /^(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.apple\.com|openstreetmap\.org)/i;

/**
 * Jedno polje: link ili adresa.
 * "https://maps.app.goo.gl/abc"  -> { maps_url, address: null }
 * "maps.app.goo.gl/abc"          -> { maps_url: "https://maps.app.goo.gl/abc", address: null }
 * "Obala 10"                     -> { maps_url: null, address: "Obala 10" }
 */
export function parseLocationText(text) {
  const t = (text || '').trim();
  if (!t) return { maps_url: null, address: null };
  // link se često zalijepi s tekstom ispred (npr. "Bar Riva https://maps.app.goo.gl/..")
  const found = t.match(/https?:\/\/\S+/i);
  if (found) {
    const url = safeUrl(found[0]);
    if (url) return { maps_url: url, address: null };
  }
  if (!/\s/.test(t) && MAP_HOSTS.test(t)) {
    const url = safeUrl('https://' + t);
    if (url) return { maps_url: url, address: null };
  }
  return { maps_url: null, address: t.slice(0, 200) };
}

/** Link za gumb Karta. */
export function mapsLink(place) {
  if (hasGps(place)) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  }
  const own = place.maps_url ? safeUrl(place.maps_url) : null;
  if (own) return own;
  const q = [place.name, place.address, place.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Kratki opis za stranicu kafića. */
export function locationSummary(place) {
  if (hasGps(place)) return 'Točna lokacija (GPS)';
  if (place.maps_url) return 'Lokacija s Google Mapsa';
  if (place.address) return place.address;
  return '';
}

/** Dohvati GPS s mobitela. */
export function getGps() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Ovaj preglednik ne podržava lokaciju.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
        lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
        accuracy: Math.round(pos.coords.accuracy || 0),
      }),
      (err) => {
        if (err.code === 1) {
          reject(new Error('Lokacija nije dopuštena. iPhone: Postavke → Privatnost → Lokacijske usluge → Safari. Samsung: u pregledniku dodirni lokot pored adrese → Dozvole → Lokacija.'));
        } else if (err.code === 3) {
          reject(new Error('Lokacija se nije stigla odrediti. Probaj ponovno, po mogućnosti bliže prozoru ili vani.'));
        } else {
          reject(new Error('Lokacija trenutno nije dostupna. Provjeri je li uključena na mobitelu.'));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

// ---------------------------------------------------------------------
//  Dio forme: [Spremi lokaciju]  + polje "ili zalijepi link / upiši adresu"
// ---------------------------------------------------------------------
export function locationFieldHTML(prefix) {
  return `
    <div class="loc" id="${prefix}-loc">
      <button type="button" class="loc-btn" id="${prefix}-gps">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>
        <span class="loc-btn-text">Spremi lokaciju</span>
      </button>
      <div class="loc-status" id="${prefix}-gps-status" hidden></div>
      <label for="${prefix}-loctext" class="loc-or">ili zalijepi link s Google Mapsa ili upiši adresu</label>
      <input id="${prefix}-loctext" autocomplete="off" autocapitalize="sentences" placeholder="https://maps.app.goo.gl/… ili Obala 10">
    </div>`;
}

/**
 * Poveže dio forme. Vraća { get(), set(place) }.
 * get() -> { lat, lng, maps_url, address }
 */
export function bindLocationField(root, prefix, initial) {
  const btn = root.querySelector(`#${prefix}-gps`);
  const status = root.querySelector(`#${prefix}-gps-status`);
  const text = root.querySelector(`#${prefix}-loctext`);
  let gps = null; // { lat, lng, accuracy? }

  const paint = (message = '', kind = '') => {
    if (gps) {
      status.hidden = false;
      status.className = 'loc-status ok';
      status.innerHTML = `<span>Lokacija spremljena${gps.accuracy ? ` · točnost ±${esc(gps.accuracy)} m` : ''}</span>
        <button type="button" class="link danger" data-loc-clear>Makni</button>`;
      btn.querySelector('.loc-btn-text').textContent = 'Spremi ponovno';
      btn.classList.add('done');
    } else {
      status.hidden = !message;
      status.className = `loc-status ${kind}`;
      status.textContent = message;
      btn.querySelector('.loc-btn-text').textContent = 'Spremi lokaciju';
      btn.classList.remove('done');
    }
  };

  const set = (place) => {
    gps = hasGps(place) ? { lat: place.lat, lng: place.lng } : null;
    text.value = place?.maps_url || place?.address || '';
    paint();
  };

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.querySelector('.loc-btn-text').textContent = 'Tražim lokaciju…';
    try {
      gps = await getGps();
      paint();
    } catch (err) {
      paint(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  status.addEventListener('click', (e) => {
    if (e.target.closest('[data-loc-clear]')) { gps = null; paint(); }
  });

  set(initial || null);

  return {
    get() {
      const parsed = parseLocationText(text.value);
      return { lat: gps?.lat ?? null, lng: gps?.lng ?? null, ...parsed };
    },
    set,
  };
}

/** Je li se lokacija promijenila u odnosu na kafić? */
export function locationChanged(place, loc) {
  const same = (a, b) => (a ?? null) === (b ?? null);
  return !same(place.lat, loc.lat) || !same(place.lng, loc.lng) ||
    !same(place.maps_url || null, loc.maps_url) || !same(place.address || null, loc.address);
}
