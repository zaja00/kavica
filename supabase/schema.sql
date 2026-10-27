-- =====================================================================
--  KAVICA – baza za Supabase (Postgres)
--
--  Kako se koristi: Supabase -> SQL Editor -> New query -> zalijepi
--  CIJELU ovu datoteku -> Run.
--  Sigurno je pokrenuti je i više puta (ništa se ne briše).
-- =====================================================================


-- ---------------------------------------------------------------------
--  1) KAFIĆI
-- ---------------------------------------------------------------------
create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- stupci (dodaju se i ako tablica već postoji iz neke starije verzije)
alter table public.places add column if not exists city       text;
alter table public.places add column if not exists address    text;
alter table public.places add column if not exists maps_url   text;
alter table public.places add column if not exists lat        double precision;
alter table public.places add column if not exists lng        double precision;
alter table public.places add column if not exists tags       text[] not null default '{}';
alter table public.places add column if not exists favorite   boolean not null default false;
alter table public.places add column if not exists updated_at timestamptz not null default now();

-- provjere ispravnosti podataka
alter table public.places drop constraint if exists places_name_len;
alter table public.places add  constraint places_name_len    check (char_length(name) between 1 and 120);
alter table public.places drop constraint if exists places_city_len;
alter table public.places add  constraint places_city_len    check (city is null or char_length(city) <= 80);
alter table public.places drop constraint if exists places_address_len;
alter table public.places add  constraint places_address_len check (address is null or char_length(address) <= 200);
alter table public.places drop constraint if exists places_maps_url_ok;
alter table public.places add  constraint places_maps_url_ok check (maps_url is null or (char_length(maps_url) <= 500 and maps_url ~* '^https?://'));
alter table public.places drop constraint if exists places_lat_ok;
alter table public.places add  constraint places_lat_ok      check (lat is null or lat between -90 and 90);
alter table public.places drop constraint if exists places_lng_ok;
alter table public.places add  constraint places_lng_ok      check (lng is null or lng between -180 and 180);
alter table public.places drop constraint if exists places_latlng_pair;
alter table public.places add  constraint places_latlng_pair check ((lat is null) = (lng is null));


-- ---------------------------------------------------------------------
--  2) POSJETI (jedan posjet = jedna zajednička ocjena)
--     ratings je npr. {"kava":5,"ambijent":4}, pa se kategorije mogu
--     mijenjati u js/config.js bez diranja baze.
-- ---------------------------------------------------------------------
create table if not exists public.visits (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  visit_date date not null default current_date,
  ratings    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.visits add column if not exists updated_at timestamptz not null default now();

-- ocjene moraju biti cijeli brojevi od 1 do 5
create or replace function public.kavica_valid_ratings(r jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(r) = 'object'
     and coalesce(bool_and(
           jsonb_typeof(e.value) = 'number'
           and (e.value #>> '{}')::numeric between 1 and 5
           and (e.value #>> '{}')::numeric % 1 = 0
         ), true)
  from jsonb_each(case when jsonb_typeof(r) = 'object' then r else '{}'::jsonb end) as e;
$$;

alter table public.visits drop constraint if exists visits_ratings_ok;
alter table public.visits add  constraint visits_ratings_ok check (public.kavica_valid_ratings(ratings));

create index if not exists visits_place_idx on public.visits (place_id);
create index if not exists visits_date_idx  on public.visits (visit_date desc);


-- ---------------------------------------------------------------------
--  3) updated_at se sam osvježi kod svake promjene
-- ---------------------------------------------------------------------
create or replace function public.kavica_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.kavica_touch();

drop trigger if exists visits_touch on public.visits;
create trigger visits_touch before update on public.visits
  for each row execute function public.kavica_touch();


-- ---------------------------------------------------------------------
--  4) SIGURNOST
--     Bez prijave se ne vidi i ne može mijenjati NIŠTA.
--     Prijavljeni (vaš zajednički račun) smije sve.
-- ---------------------------------------------------------------------
alter table public.places enable row level security;
alter table public.visits enable row level security;

revoke all on public.places from anon;
revoke all on public.visits from anon;
grant select, insert, update, delete on public.places to authenticated;
grant select, insert, update, delete on public.visits to authenticated;

drop policy if exists "kavica: prijavljeni sve" on public.places;
create policy "kavica: prijavljeni sve" on public.places
  for all to authenticated using (true) with check (true);

drop policy if exists "kavica: prijavljeni sve" on public.visits;
create policy "kavica: prijavljeni sve" on public.visits
  for all to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
--  5) SAMO JEDAN RAČUN
--     Baza ne dopušta drugi račun, čak i ako netko slučajno ostavi
--     uključenu registraciju. (Lozinku računa mijenjaš u Supabaseu.)
-- ---------------------------------------------------------------------
create or replace function public.kavica_only_one_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users where id <> new.id) then
    raise exception 'Kavica dopušta samo jedan zajednički račun.';
  end if;
  return new;
end;
$$;

drop trigger if exists kavica_only_one_user on auth.users;
create trigger kavica_only_one_user before insert on auth.users
  for each row execute function public.kavica_only_one_user();


-- ---------------------------------------------------------------------
--  6) SINKRONIZACIJA UŽIVO (Realtime)
--     Kad jedno od vas spremi promjenu, drugome se pojavi odmah.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places') then
      alter publication supabase_realtime add table public.places;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits') then
      alter publication supabase_realtime add table public.visits;
    end if;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
--  Gotovo. Provjera: ova naredba treba vratiti places i visits.
-- ---------------------------------------------------------------------
select tablename as "tablice za sinkronizaciju"
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
