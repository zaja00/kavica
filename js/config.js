// =====================================================================
//  KAVICA – postavke
//  Ovo je jedina datoteka koju moraš urediti da aplikacija proradi.
// =====================================================================

// --- 1) Supabase (besplatna baza) -------------------------------------
// Kopiraj iz Supabase: Project Settings -> API
//  - Project URL
//  - anon / publishable key
// Ovaj ključ je JAVAN po dizajnu (smije biti na GitHubu). Podatke štite
// sigurnosna pravila iz supabase/schema.sql i zajednička lozinka.
// NIKADA ovdje ne stavljaj "service_role" ključ!
export const SUPABASE_URL = 'https://jouqnkxjxazkacvjgpiq.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdXFua3hqeGF6a2FjdmpncGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzQyMDQsImV4cCI6MjEwODcxMDIwNH0.WmI7yijMqOYhBs2_TqU8MXfDTn7Xsw2tNz6d7mAzd-c';

// Email zajedničkog računa koji napraviš u Supabaseu (Authentication -> Users).
// U aplikaciji se upisuje samo lozinka; email se nigdje ne prikazuje.
export const SHARED_EMAIL = 'kavica@kavica.hr';

// --- 2) Naziv aplikacije (kartica preglednika, ikona na mobitelu) -----
export const APP_NAME = 'Kavica';

// --- 3) Kategorije ocjenjivanja ---------------------------------------
// Dodavanje / micanje / preimenovanje kategorije = samo uredi ovaj popis.
// Ne treba mijenjati bazu. VAŽNO: `key` ne mijenjaj kad već imate ocjene
// (mijenjaj samo `label`), inače stare ocjene te kategorije nestaju iz prikaza.
export const CATEGORIES = [
  { key: 'kava',     label: 'Kava',           hint: 'Okus i kvaliteta' },
  { key: 'ambijent', label: 'Ambijent',       hint: 'Atmosfera, glasnoća, gužva' },
  { key: 'usluga',   label: 'Usluga',         hint: 'Osoblje, brzina' },
  { key: 'cijena',   label: 'Cijena',         hint: 'Odnos cijene i kvalitete' },
  { key: 'uredenje', label: 'Uređenje',       hint: 'Kako izgleda prostor' },
  { key: 'lokacija', label: 'Lokacija',       hint: 'Gdje je, pogled' },
];

// --- 4) Što kafić ima (da/ne) – koristi se za filter ---------------
// Dodavanje / micanje = samo uredi popis. `key` ne mijenjaj kad su već
// označeni kafići (mijenjaj samo `label`).
export const FEATURES = [
  { key: 'vani',    label: 'Vanjski dio',   hint: 'Terasa ili stolovi vani' },
  { key: 'unutra',  label: 'Unutarnji dio', hint: 'Može se sjediti unutra' },
  { key: 'more',    label: 'Uz more',       hint: 'Blizu mora ili pogled na more' },
  { key: 'parking', label: 'Parking',       hint: 'Ima gdje parkirati' },
  { key: 'tiho',    label: 'Tiho',          hint: 'Može se mirno razgovarati' },
];

// --- 5) Kalendar: koje godine se mogu odabrati -----------------------
export const CALENDAR_FIRST_YEAR = 2026;
export const CALENDAR_LAST_YEAR = 2035;

// Najveća ocjena (zvjezdice)
export const MAX_STARS = 5;
