# Kavica 🐱☕

Naš dnevnik kafića: zajedno ocijenimo kavu, ambijent, uslugu i ostalo, označimo što kafić ima
(vani, unutra, uz more, parking, tiho), spremimo lokaciju, a rang lista kaže gdje je najbolje.
Ti i ona vidite isto na oba mobitela, a promjene se pojave za par sekundi.

**Sve je besplatno, bez kartice:**
- **GitHub Pages:** aplikacija i adresa `tvojeime.github.io/kavica`
- **Supabase Free:** baza, lozinka i sinkronizacija uživo
- **GitHub Actions:** automatska kopija dvaput tjedno, u privatni repozitorij

Kod je čisti HTML/CSS/JS, bez buildanja i bez npm-a.

---

## Pregled svih koraka

1. Supabase: napravi bazu (10 min)
2. Upiši ključeve u `js/config.js` (2 min)
3. GitHub: objavi aplikaciju (5 min)
4. Mobiteli: dodaj ikonu na početni zaslon (1 min po mobitelu)
5. GitHub: postavi automatsku kopiju (5 min)
6. Zajedno isprobajte prema popisu na dnu

> Izgled Supabasea i GitHuba se s vremenom malo mijenja. Ako neki gumb ima malo drugačije ime,
> traži nešto slično (npr. "API" ili "API Keys").

---

## 1) Supabase – baza

1. Otvori [supabase.com](https://supabase.com), klikni **Start your project** i prijavi se **GitHubom**.
2. **New project**:
   - Name: `kavica`
   - Database Password: klikni **Generate** i spremi je negdje. Ne treba u aplikaciji, ali neka je imaš.
   - Region: **Central EU (Frankfurt)**, najbliže Hrvatskoj
   - Plan: **Free**
   - Pričekaj minutu-dvije da se projekt napravi.
3. Lijevo **SQL Editor → New query**. Otvori `supabase/schema.sql`, kopiraj **cijeli** sadržaj,
   zalijepi i klikni **Run**. Na dnu se trebaju pojaviti `places` i `visits`.
   - Ako Supabase pita nešto o "destructive operation", potvrdi: skripta ništa ne briše.
4. **Authentication → Users → Add user → Create new user**:
   - Email: smisli email za vaš zajednički račun, npr. `kavica@nas-dnevnik.hr`. Ne mora biti
     pravi i ne šalje se na njega ništa, ali **zapamti ga točno**.
   - Password: `kavica`
   - Uključi **Auto Confirm User**, pa klikni **Create user**.
5. **Authentication → Sign In / Providers** (ponegdje **Providers → Email**): isključi
   **Allow new users to sign up** i spremi. Tako se nitko drugi ne može registrirati.
   Baza ionako ne dopušta drugi račun.
6. **Project Settings → API** (ili **API Keys**) i kopiraj dvije stvari:
   - **Project URL**, npr. `https://abcdxyz.supabase.co`
   - **anon public** ključ. Ako postoji kartica **Legacy API keys**, uzmi `anon` odande.
     Ako je nema, uzmi **Publishable key**.

> **Nikada** nemoj nigdje kopirati `service_role` ni `secret` ključ.

## 2) `js/config.js`

Otvori `js/config.js` i upiši:

```js
export const SUPABASE_URL = 'https://abcdxyz.supabase.co';  // tvoj Project URL
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';           // anon / publishable ključ
export const SHARED_EMAIL = 'kavica@nas-dnevnik.hr';        // email iz koraka 1.4
```

Je li u redu da je ovo javno na GitHubu? Da, `anon` ključ je napravljen da bude javan. Podaci su
zaštićeni sigurnosnim pravilima u bazi i lozinkom. Bez lozinke se ne vidi ništa.

## 3) GitHub – objavi aplikaciju

1. Na GitHubu **New repository**:
   - ime: `kavica`
   - vidljivost: **Public**, jer je besplatni GitHub Pages samo za javne repozitorije
     (podaci nisu u njemu, nego u bazi)
2. **Add file → Upload files** i povuci sve iz ove mape **osim mape `backup-repo`**
   (ona ide u drugi, privatni repozitorij, korak 5). Klikni **Commit changes**.
3. **Settings → Pages → Build and deployment**: Source = **Deploy from a branch**,
   Branch = **main**, folder **/(root)**, pa **Save**.
4. Za 1–2 minute aplikacija je na `https://TVOJE-IME.github.io/kavica/`. Na istom mjestu u
   postavkama Pagesa piše točan link.

## 4) Na mobitelima

Otvori link, upiši lozinku `kavica` i dodaj Kavicu na početni zaslon:

- **iPhone (Safari):** gumb Podijeli (kvadrat sa strelicom) → **Dodaj na početni zaslon** → Dodaj.
  Otvori Kavicu s nove ikone i **još jednom upiši lozinku**, jer iPhone tu ikonu drži odvojeno od Safarija.
- **Samsung (Chrome):** ⋮ gore desno → **Dodaj na početni zaslon** ili **Instaliraj aplikaciju**.
- **Samsung (Samsung Internet):** izbornik ☰ → **Dodaj stranicu u** → **Početni zaslon**.

Lozinka se pamti, pa je ne treba stalno upisivati.

**Lokacija (gumb "Spremi lokaciju"):** prvi put mobitel pita smije li Kavica znati lokaciju,
odaberi **Dopusti**. Ako si slučajno odbio:
- iPhone: Postavke → Privatnost i sigurnost → Lokacijske usluge → Safari web-stranice → Tijekom upotrebe
- Samsung: u pregledniku dodirni ikonu lijevo od adrese → Dozvole → Lokacija → Dopusti

## 5) Automatska kopija

Upute su u `backup-repo/README.md`. Ukratko:
1. napravi **privatni** repozitorij `kavica-kopije`;
2. ubaci mu sadržaj mape `backup-repo`;
3. dodaj 4 tajne;
4. jednom ručno pokreni kopiju da vidiš da radi.

Kopija se poslije sama radi ponedjeljkom i četvrtkom, a usput sprječava da se besplatna baza uspava.

## 6) Isprobajte zajedno (5 minuta)

- [ ] Ti na Samsungu dodaš izmišljeni kafić "Test" → za par sekundi se pojavi njoj na iPhoneu
- [ ] Ona na iPhoneu doda novi posjet istom kafiću → tebi se pojavi na Samsungu
- [ ] Srce (favorit) na jednom mobitelu → vidi se na drugom
- [ ] "Spremi lokaciju" u kafiću → gumb **Karta** otvara točno to mjesto
- [ ] Filter (npr. 4+ i Uz more) prikazuje prave kafiće
- [ ] Uredite i obrišite posjet, pa obrišite kafić "Test"
- [ ] Zatvorite Kavicu na jednom mobitelu, dodajte nešto na drugom, ponovno je otvorite → novo je tu

Ako sve prođe, Kavica je spremna. 🎉

---

## Kad nešto ne radi

| Što vidiš | Što napraviti |
|---|---|
| "Kriva lozinka" | Provjeri da je lozinka računa u Supabaseu `kavica` i da je `SHARED_EMAIL` **točno** isti email |
| "Račun nije potvrđen" | Authentication → Users → tvoj račun → Confirm, ili ga napravi ponovno s Auto Confirm |
| "Tablice u bazi ne postoje" | Ponovno pokreni `supabase/schema.sql` u SQL Editoru |
| "Nema interneta ili baza ne odgovara" | Provjeri internet. Ako je baza bila uspavana: Supabase → projekt → **Restore**, podaci ostaju |
| Promjene se ne vide odmah na drugom mobitelu | Pojave se najkasnije za 30 sekundi ili kad se Kavica ponovno otvori. Za "odmah" provjeri da je `schema.sql` pokrenut (dio 6 uključuje sinkronizaciju) |
| Na adresi piše "Demo" / "Pregled s primjerima" | `js/config.js` nije popunjen ili nije učitan na GitHub |
| Na mobitelu se vidi stara verzija | Zatvori i ponovno otvori Kavicu. Kad mijenjaš kod, u `sw.js` povećaj `VERSION` |

## Prilagodbe

| Što | Gdje |
|---|---|
| Kategorije ocjena | `js/config.js` → `CATEGORIES` |
| Što kafić ima (filter) | `js/config.js` → `FEATURES` |
| Godine u kalendaru | `js/config.js` → `CALENDAR_FIRST_YEAR`, `CALENDAR_LAST_YEAR` |
| Boje | `css/style.css`, na vrhu (`:root`) |
| Logo i ikone | `icons/` |
| Lozinka | Supabase → Authentication → Users → tvoj račun → promijeni lozinku (i u tajnama kopije) |

Kod kategorija i značajki mijenjaj samo `label`, a nikad `key` kad već imate podatke.

## Isprobavanje bez baze

```bash
python3 -m http.server 8000
# otvori http://localhost:8000/?demo   (lozinka: kavica)
```

## Struktura

```
index.html              ljuska aplikacije
manifest.webmanifest    ikona i ime za početni zaslon
sw.js                   brže otvaranje, instalacija na mobitel
css/style.css           izgled
js/config.js            ⭐ ključevi, kategorije, značajke, godine
js/app.js               ekrani i logika
js/db.js                veza sa Supabaseom
js/db-demo.js           demo baza (za isprobavanje)
js/location.js          GPS, link, adresa, karta
js/calendar.js          kalendar
js/score.js             izračun ocjena
js/ui.js                zvjezdice, obavijesti, dijalozi
icons/                  logo i ikone
fonts/                  (neobavezno) naslovni font
supabase/schema.sql     baza, sigurnost, sinkronizacija
backup-repo/            ide u PRIVATNI repozitorij (kopije)
```
