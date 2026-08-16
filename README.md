# 72 sekunde – katolički kviz

Mobile-first kviz aplikacija za projekt "72 sata bez kompromisa". Igrač ima 72 sekunde da odgovori na što više od 120 pitanja (72H, Marija Bistrica, Biblija, katolička vjera, sveci, Marija i krunica).

Stack: **React + Vite + TypeScript + Tailwind** (frontend) · **Node.js + Express + TypeScript** (backend) · **Supabase Postgres** (baza) · **Resend** (e-mail) · **Render** (hosting).

---

## 1. Struktura projekta

```
72sekunde/
├── backend/            Express API server
│   ├── src/
│   │   ├── routes/     public.ts (igra), admin.ts (admin panel)
│   │   ├── lib/        supabase klijent, algoritam odabira pitanja, auth, email
│   │   ├── middleware/ rate limiting
│   │   └── __tests__/  vitest testovi (baza pitanja + algoritam)
│   ├── scripts/        seed.ts, questionBank.ts (120 pitanja), hashPassword.ts
│   └── sql/schema.sql  Postgres shema za Supabase
├── frontend/           React SPA
│   └── src/
│       ├── pages/       Landing, Register, Quiz, Result, Privacy, Rules
│       ├── admin/       Admin login + dashboard (pitanja, igrači, postavke, export)
│       └── lib/         API klijenti
└── render.yaml          Render deployment konfiguracija
```

---

## 2. Lokalna instalacija

### Preduvjeti
- Node.js 20+
- Supabase račun (besplatan plan je dovoljan)
- Resend račun (besplatan plan je dovoljan) — opcionalno za lokalni razvoj, kviz radi i bez njega (e-mailovi se samo neće slati)

### 2.1 Kreiraj Supabase bazu

1. Idi na https://supabase.com i napravi novi projekt.
2. U **SQL Editor** zalijepi i pokreni sadržaj `backend/sql/schema.sql`. Ovo kreira sve tablice (`players`, `attempts`, `questions`, `answers`, `event_config`) i `leaderboard_view`.
3. U **Project Settings → API** pronađi:
   - `Project URL` → ovo je `SUPABASE_URL`
   - `service_role` ključ (ne `anon` ključ!) → ovo je `SUPABASE_SERVICE_ROLE_KEY`

⚠️ `service_role` ključ ima pune ovlasti nad bazom i **nikad** se ne smije naći u frontend kodu ili u browseru. Koristi se isključivo u backendu.

### 2.2 Konfiguriraj Resend (opcionalno)

1. Napravi račun na https://resend.com
2. Verificiraj domenu (ili koristi test domenu za razvoj)
3. Kreiraj API ključ → `RESEND_API_KEY`
4. Postavi `EMAIL_FROM`, npr. `"72 sekunde <kviz@tvoja-domena.hr>"`

### 2.3 Backend

```bash
cd backend
cp .env.example .env
# uredi .env i unesi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, itd.

npm install

# generiraj bcrypt hash za admin lozinku i zalijepi ga u .env kao ADMIN_PASSWORD_HASH
npx tsx scripts/hashPassword.ts "tvoja-tajna-lozinka"

# napuni bazu sa svih 120 pitanja (idempotentno, sigurno pokrenuti više puta)
npm run seed

# pokreni testove koji provjeravaju bazu pitanja i algoritam odabira
npm test

# pokreni razvojni server na http://localhost:4000
npm run dev
```

### 2.4 Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:4000 (zadano, za lokalni razvoj)

npm install
npm run dev
# otvori http://localhost:5173
```

---

## 3. Environment varijable

### Backend (`backend/.env`)

| Varijabla | Opis |
|---|---|
| `PORT` | Port na kojem server sluša (zadano 4000) |
| `SUPABASE_URL` | URL Supabase projekta |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role ključ (tajna, samo backend) |
| `RESEND_API_KEY` | API ključ za slanje e-mailova |
| `EMAIL_FROM` | "From" adresa za e-mailove |
| `ADMIN_EMAIL` | E-mail za admin prijavu |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash admin lozinke (generiraj pomoću `scripts/hashPassword.ts`) |
| `JWT_SECRET` | Nasumični dugi string za potpisivanje admin JWT tokena |

### Frontend (`frontend/.env`)

| Varijabla | Opis |
|---|---|
| `VITE_API_BASE_URL` | URL backend API-ja (npr. `https://72sekunde-backend.onrender.com`) |

---

## 4. Testovi

```bash
cd backend
npm test
```

Testovi provjeravaju (spec. odjeljak 31):
- točno 120 aktivnih pitanja
- jedinstveni ID-jevi
- svako pitanje ima A/B/C i točan odgovor je A/B/C
- nema pitanja bez/nepoznate kategorije
- nema pitanja s identičnim A/B/C odgovorima
- nema potpuno dupliciranih pitanja
- raspodjela po kategorijama (30/20/20/20/15/15) i težini (25/50/25%)

Dodatno se testira i **algoritam odabira pitanja** (`questionSelector.test.ts`):
- prvih 5 pitanja je uvijek 72H
- svaki pokušaj ima barem 8 pitanja iz 72H
- nema ponavljanja pitanja unutar pokušaja
- nijedna kategorija ne dominira s 20+ pitanja
- pitanja iz iste kategorije rijetko dolaze uzastopno (izvan prvih 5)
- redoslijed je nasumičan između pokušaja

## 5. Kako radi server-authoritative timer i anti-cheat

- Kad pokušaj (`attempt`) krene, backend zapisuje `started_at` i `expires_at = started_at + 72s` u bazu.
- Frontend prikazuje odbrojavanje isključivo izračunato iz `expiresAt` (server timestamp) minus trenutno lokalno vrijeme — vizualni prikaz, ne izvor istine.
- Svaki poziv (`/question`, `/answer`, `/finish`) backend provjerava je li `Date.now() >= expires_at`; ako jest, pokušaj se zatvara i odgovori se odbijaju.
- Rezultat (`score`) se uvijek preračunava iz spremljenih `answers` zapisa u bazi — nikad se ne vjeruje broju koji eventualno stigne s klijenta (klijent ga uopće i ne šalje).
- Jedan e-mail = jedan dovršeni pokušaj (provjerava se prije stvaranja pokušaja i ponovno prije završetka).
- API endpointi nikad ne vraćaju `correct_answer` prije nego korisnik odgovori na pitanje.
- Rate limiting je postavljen na `/api/*` (120 zahtjeva/min) i posebno strože na `/attempts/:id/answer` te `/admin/login`.

---

## 6. Deployment na Render

### 6.1 Automatski (preporučeno) — koristeći `render.yaml`

1. Pushaj repozitorij na GitHub.
2. U Render dashboardu klikni **New → Blueprint** i odaberi repozitorij. Render će pročitati `render.yaml` i predložiti dva servisa: `72sekunde-backend` (Web Service) i `72sekunde-frontend` (Static Site).
3. Prije deploya, popuni environment varijable (Render će tražiti one označene `sync: false`):
   - Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (`JWT_SECRET` se generira automatski)
   - Frontend: `VITE_API_BASE_URL` postavi na URL backend servisa nakon što se deploya (npr. `https://72sekunde-backend.onrender.com`)
4. Deploy.

### 6.2 Ručno

**Backend (Web Service):**
- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Plan: Free

**Frontend (Static Site):**
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Rewrite rule: `/*` → `/index.html` (za React Router)

### 6.3 Nakon deploya

```bash
# pokreni seed skriptu jednom, lokalno, uperenu na produkcijsku Supabase bazu
# (ili je pokreni kao "Manual Job" u Render dashboardu ako je backend repo tamo)
cd backend
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
```

Napomena: aplikacija namjerno **ne koristi** Render-ov lokalni filesystem niti besplatni Postgres kao primarnu bazu (SQLite/lokalna baza na Renderu ne bi preživjela restart/deploy), i **ne koristi** SMTP nego Resend REST API (Render Free plan blokira odlazne SMTP konekcije).

---

## 7. QR kod / ulazna točka

QR kod treba voditi na:

```
https://tvoja-frontend-domena.onrender.com/
```

Nema obaveznog kreiranja računa — korisnik odmah unosi ime/nadimak i e-mail i kreće s kvizom.

---

## 8. Admin panel

URL: `https://tvoja-frontend-domena.onrender.com/admin`

Prijava koristi `ADMIN_EMAIL` / lozinku čiji bcrypt hash čuvaš u `ADMIN_PASSWORD_HASH` (vidi 2.3 kako generirati hash). Admin panel omogućuje:
- pregled dashboard statistike
- pregled i pretragu ljestvice
- pregled igrača, brisanje osobe (GDPR), povlačenje marketinške privole
- CRUD nad pitanjima (uređivanje deaktivira umjesto trajnog brisanja, radi integriteta povijesnih odgovora)
- uređivanje `event_config` (slogan, godina, URL-ovi, organizator, dobni raspon)
- export CSV-a (samo ime, e-mail, rezultat, broj odgovora, datum, marketing consent)

---

## 9. Poznata ograničenja

- Leaderboard i statistika se računaju "on read" (bez cache sloja); za par stotina/tisuća igrača na jednom eventu to je više nego dovoljno brzo, ali za jako velik broj istovremenih upita bilo bi vrijedno dodati keširanje.
- E-mail slanje je "fire-and-forget" (ne blokira response korisniku); ako Resend padne, korisnik i dalje dobiva svoj rezultat, samo bez e-maila.
- Admin CRUD za pitanja ne mijenja `question_order` postojećih već započetih pokušaja (po dizajnu — pokušaj u tijeku ne smije promijeniti pravila igre ispod nogu igraču).
- Nema ugrađenog CAPTCHA/fingerprinting sloja (namjerno, po specifikaciji – "ne pokušavati raditi agresivne fingerprinting metode"); anti-cheat se oslanja na server-authoritative timer, one-attempt-per-email i rate limiting.
