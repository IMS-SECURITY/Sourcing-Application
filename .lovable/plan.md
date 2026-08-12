# Firebase Migration — Phased Plan (fits daily free credits)

Goal: replace Supabase/Lovable Cloud with Firebase (Auth + Firestore + Storage + Cloud Functions) so you can run the app locally with your own free Firebase project. Each phase is scoped small enough to fit in ~5 daily credits. Do them one per day, in order.

Before starting you must create (free, no card): a Firebase project, enable Email/Password + Google Auth, create a Firestore database (production mode), enable Storage, and download a web app config + a service-account JSON.

---

## Phase 1 — Firebase project wiring (foundation)
- Add `firebase` and `firebase-admin` packages.
- Create `src/integrations/firebase/client.ts` (browser: auth, firestore, storage).
- Create `src/integrations/firebase/admin.server.ts` (service account, admin SDK).
- Add env vars: `VITE_FIREBASE_*` (public config) + `FIREBASE_SERVICE_ACCOUNT_JSON` (server).
- No feature changes yet. App still runs on Supabase.

## Phase 2 — Auth swap
- Replace `supabase.auth` in `src/hooks/use-auth.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, and Google sign-in with Firebase Auth (`onAuthStateChanged`, `signInWithEmailAndPassword`, `signInWithPopup(GoogleAuthProvider)`).
- Rewrite `attachSupabaseAuth` middleware → `attachFirebaseAuth` (sends Firebase ID token).
- Rewrite `requireSupabaseAuth` server middleware → verify ID token with `admin.auth().verifyIdToken`.

## Phase 3 — Roles + profiles collection
- Create Firestore collections: `profiles/{uid}`, `user_roles/{uid}` (array of roles).
- On first sign-up, create profile + assign role (first user = `hr_admin`, else per `signup_as`).
- Update `useRoles` hook to read from Firestore.
- Port `has_role` check to a server helper using admin SDK.

## Phase 4 — Core collections schema + security rules
- Map tables → collections: `candidates`, `vacancies`, `clients`, `candidate_applications`, `interviews`, `comments`, `stage_history`, `notifications`, `replacement_employees`, `extensions`, `audit_logs`, `email_send_log`.
- Write `firestore.rules` mirroring current RLS (owner-based + role-based).
- No UI changes yet.

## Phase 5 — Candidates + Vacancies CRUD
- Rewrite queries in `candidates.index/new/$id.tsx` and `vacancies.index/new/$id.tsx` to use Firestore (`getDocs`, `addDoc`, `updateDoc`, `onSnapshot`).
- Remove Supabase calls from these pages.

## Phase 6 — Clients, Interviews, Pipeline, Comments
- Port `clients.tsx`, `interviews.index.tsx`, `vacancies.$id.pipeline.tsx`, comments to Firestore.
- Port `stage_history` writes.

## Phase 7 — Storage (resumes) + public jobs pages
- Move `resumes` bucket to Firebase Storage with rules (owner + hr_admin read).
- Update resume upload/download code.
- Port public `jobs.index.tsx` / `jobs.$id.tsx` to read published vacancies from Firestore.

## Phase 8 — Server functions + dashboard + admin
- Convert `hr-digest`, `notify`, admin user-create, and dashboard queries to admin SDK.
- Rewrite `/api/public/hooks/hr-daily-digest` using admin SDK.
- Email sending (Gmail) stays as-is.

## Phase 9 — Cleanup + local run guide
- Delete Supabase integration files, migrations, `supabase/` folder.
- Remove `@supabase/*` deps.
- Add `README-LOCAL.md` with: `bun install`, set `.env`, `bun run dev` → http://localhost:8080.
- Verify all routes load with no 404s.

---

## Technical details

- Firestore has no joins — denormalize (e.g. store `vacancy_title` on `candidate_applications`).
- No enums — use string literals + rules validation.
- No `auth.uid()` triggers — use Cloud Functions `onCreate` for the "first user = admin" logic, or handle it client-side on first sign-in.
- ID token verification runs on Cloudflare Workers via `firebase-admin` REST fallback OR switch SSR entry to Node — I'll use the `jose`-based JWT verification against Google's public keys (Worker-compatible) to avoid `firebase-admin` in the Worker.
- Realtime lists use `onSnapshot`; one-shot reads use `getDocs`.

## What I need from you before Phase 1
1. Confirm you've created a Firebase project.
2. Paste the web app config (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`) — safe to share, they're public.
3. Generate a service account JSON (Project Settings → Service Accounts → Generate new private key) — I'll store it via `add_secret`, never in code.

Reply "start phase 1" (with the config above) when ready and I'll do only Phase 1 that day.
