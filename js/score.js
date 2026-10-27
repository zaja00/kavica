// =====================================================================
//  Izračun ocjena (čista logika, bez sučelja).
//
//  - Jedan posjet = jedna zajednička ocjena po kategorijama.
//  - Ukupna ocjena posjeta = prosjek kategorija koje su ocijenjene
//    (neocijenjene se ne računaju, pa neobavezne ne kvare prosjek).
//  - Ocjena kafića = prosjek svih posjeta.
//  - Ocjena kafića za kategoriju = prosjek posjeta u kojima je ta
//    kategorija ocijenjena.
// =====================================================================

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function mean(list) {
  const nums = list.filter(isNum);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Ukupna ocjena jednog posjeta (samo kategorije koje postoje u config.js). */
export function visitOverall(visit, categoryKeys) {
  const r = visit.ratings || {};
  return mean(categoryKeys.map((k) => r[k]));
}

/**
 * Statistika jednog kafića.
 * @param {Array} visits  posjeti SAMO tog kafića
 * @param {Array<string>} categoryKeys
 */
export function placeStats(visits, categoryKeys) {
  const cats = {};
  for (const key of categoryKeys) {
    cats[key] = mean(visits.map((v) => (v.ratings || {})[key]));
  }
  const sorted = [...visits].sort((a, b) =>
    (b.visit_date + (b.created_at || '')).localeCompare(a.visit_date + (a.created_at || ''))
  );
  return {
    overall: mean(visits.map((v) => visitOverall(v, categoryKeys))),
    cats,
    visitCount: visits.length,
    lastVisit: sorted[0]?.visit_date || null,
  };
}

/** Vrijednost za rang listu: 'overall' ili ključ kategorije. */
export function pickValue(stats, key) {
  return key === 'overall' ? stats.overall : stats.cats[key] ?? null;
}

/** Hrvatski zapis: 4,3 */
export function fmt(value) {
  if (!isNum(value)) return '–';
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Razred ocjene za boju: 'hi' (≥4,5), 'mid' (≥3,5), 'lo', ili 'none'. */
export function tier(value) {
  if (!isNum(value)) return 'none';
  if (value >= 4.5) return 'hi';
  if (value >= 3.5) return 'mid';
  return 'lo';
}
