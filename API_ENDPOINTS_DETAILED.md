# PharmAssist Backend API Reference

This document is generated from the running application, not from a design
plan. Every route below comes from `backend/scripts/list-routes.ts`, which
prints Fastify's actual route tree (`pnpm --filter @pharmassist/backend
routes`), and every example payload is a real request/response captured
against a live server seeded with `backend/prisma/seed-data.ts`. Nothing
here is invented — if the app changes, run `pnpm --filter @pharmassist/backend
routes` again and diff it against the summary table below.

## 1. Base URL and authentication

Base URL (development): `http://localhost:3000`. All routes are under `/api`.

Authentication is a **JWT stored in an httpOnly cookie**, not a bearer
token. `POST /api/auth/login` verifies the username and password and sets:

```
set-cookie: pharmassist_session=<jwt>; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax
```

- Cookie name: `pharmassist_session`.
- `HttpOnly` — JavaScript in the page cannot read it.
- `SameSite=Lax` — no explicit CORS credential dance needed for same-site
  navigation, but cross-origin fetches still need `credentials: 'include'`.
- `Secure` is added automatically when `NODE_ENV=production`.
- Lifetime: 12 hours (`Max-Age=43200`).

**There is no `Authorization: Bearer` header anywhere in this API.** A
client that sends one will simply be ignored — the only thing that
authenticates a request is the cookie. Every request to a protected route
must be made with credentials attached (`curl -b cookiejar`, or `fetch(url,
{ credentials: 'include' })`).

`POST /api/auth/logout` clears the cookie (`Max-Age=0`). `GET /api/auth/me`
returns the current session's user, or `401 AUTH_EXPIRED` if there is no
valid session.

CORS is **off by default**. It is only registered if the `CORS_ORIGIN`
environment variable is set, and then only for the exact origin(s) listed —
never a wildcard, because the session is a credentialed cookie.

`POST /api/auth/login` is rate-limited to 20 attempts per minute, keyed on
`username + IP` (not IP alone, so one ward's shared NAT address can't lock
out everyone on it). No other route is rate-limited.

## 2. Roles

Three roles exist: `pharmacist`, `nurse`, `doctor`. A user's role and (for
nurses) ward come back in `SessionUser` on login/`/me` and are enforced
**server-side** on every request — the client cannot widen its own access
by asking for more.

| Endpoint | Required role |
|---|---|
| `POST /api/auth/login` | none (public) |
| `POST /api/auth/logout` | none |
| `GET /api/auth/me` | any authenticated user |
| `GET /api/activity` | any authenticated user |
| `GET /api/wards` | any authenticated user |
| `GET /api/wards/:id/pickup-list` | any authenticated user (ward-scoped for nurses) |
| `GET /api/patients` | any authenticated user (ward-scoped for nurses) |
| `GET /api/patients/:id` | any authenticated user (ward-scoped for nurses) |
| `POST /api/patients` | `nurse` or `pharmacist` |
| `POST /api/patients/:id/prescriptions` | `doctor` |
| `PATCH /api/prescriptions/:id` | `doctor` |
| `POST /api/prescriptions/:id/stop` | `doctor` |
| `GET /api/drugs` | any authenticated user |
| `GET /api/inventory` | any authenticated user |
| `GET /api/inventory/categories` | any authenticated user |
| `POST /api/inventory/:drugId/restock` | `pharmacist` |
| `POST /api/indents/sweep` | `pharmacist` |
| `POST /api/indents/dispense` | `pharmacist` |
| `GET /api/billing` | any authenticated user (ward-scoped for nurses) |
| `POST /api/billing/confirm` | `pharmacist` |
| `GET /api/health` | none (public) |

## 3. Ward scoping

A `nurse` account carries a `wardId` and is restricted server-side to that
one ward on every endpoint that reads or writes ward- or patient-scoped
data (`GET /api/patients`, `GET /api/patients/:id`, `GET
/api/wards/:id/pickup-list`, `GET /api/billing`, and any nurse-permitted
write). A request for a ward the nurse is not assigned to returns:

```
HTTP/1.1 403 Forbidden
{"success":false,"error":"FORBIDDEN","message":"You do not have access to that ward"}
```

**This is a 403, not a 404** — a 404 would let a nurse discover, by
elimination, which ward IDs and patient IDs exist. `pharmacist` and
`doctor` accounts have no ward and are unrestricted.

## 4. Endpoint summary

Captured from `pnpm --filter @pharmassist/backend routes`:

```
├── /api/health (GET, HEAD)
├── /api/auth/login (POST)
├── /api/auth/logout (POST)
├── /api/auth/me (GET, HEAD)
├── /api/activity (GET, HEAD)
├── /api/wards (GET, HEAD)
│   └── /:id/pickup-list (GET, HEAD)
├── /api/patients (GET, HEAD, POST)
│   └── /:id (GET, HEAD)
│       └── /prescriptions (POST)
├── /api/prescriptions/:id (PATCH)
│   └── /stop (POST)
├── /api/drugs (GET, HEAD)
├── /api/inventory (GET, HEAD)
│   ├── /categories (GET, HEAD)
│   └── /:drugId/restock (POST)
├── /api/indents/sweep (POST)
├── /api/indents/dispense (POST)
└── /api/billing (GET, HEAD)
    └── /confirm (POST)
```

| Method | Path |
|---|---|
| GET | `/api/health` |
| POST | `/api/auth/login` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |
| GET | `/api/activity` |
| GET | `/api/wards` |
| GET | `/api/wards/:id/pickup-list` |
| GET | `/api/patients` |
| POST | `/api/patients` |
| GET | `/api/patients/:id` |
| POST | `/api/patients/:id/prescriptions` |
| PATCH | `/api/prescriptions/:id` |
| POST | `/api/prescriptions/:id/stop` |
| GET | `/api/drugs` |
| GET | `/api/inventory` |
| GET | `/api/inventory/categories` |
| POST | `/api/inventory/:drugId/restock` |
| POST | `/api/indents/sweep` |
| POST | `/api/indents/dispense` |
| GET | `/api/billing` |
| POST | `/api/billing/confirm` |

Every path above is `/api/...`. There is no `/api/v1` prefix, no
`/inpatient` segment, and `HEAD` is Fastify's automatic mirror of each
`GET` — not a separately implemented route.

---

## 5. Endpoints

Everything below was captured live against a server seeded from
`backend/prisma/seed-data.ts`, using `2026-08-03` as the working date
(the date the seeded prescriptions are active for indent/pickup/billing
purposes — the sweep, dispense and billing endpoints all take an explicit
`date`; patient/prescription responses that show `currentDay` compute it
against the server's real clock instead).

### `GET /api/health`

Public. No auth required.

**Response `200`:**
```json
{"status":"ok","database":"up"}
```

### `POST /api/auth/login`

Public. Body: `{ username, password }`.

Request:
```json
{"username":"k.asante","password":"pharmassist"}
```

Response `200` (headers trimmed to the relevant ones):
```
set-cookie: pharmassist_session=<jwt>; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax
```
```json
{"user":{"id":"cmsh37i7g001eg2ev9qnxh3o4","username":"k.asante","displayName":"K. Asante","role":"pharmacist","ward":null}}
```

A nurse's `ward` is populated instead of `null`:
```json
{"user":{"id":"cmsh37i7v001gg2evnzd5uoeu","username":"a.owusu","displayName":"A. Owusu","role":"nurse","ward":{"id":"cmsh37hx40000g2ev58fa6f2g","code":"Ward 4A","name":"General Medicine","label":"Ward 4A — General Medicine"}}}
```

**Wrong password — `401`:**
```json
{"success":false,"error":"AUTH_EXPIRED","message":"Invalid username or password"}
```
An unknown username produces the exact same body — the response cannot be
used to enumerate accounts. Note the code is `AUTH_EXPIRED`, reused from
the "your session is gone" case rather than a dedicated
`INVALID_CREDENTIALS` code.

**20 failed attempts in a minute for the same username — `429`:**
```
x-ratelimit-limit: 20
x-ratelimit-remaining: 0
retry-after: 58
```
```json
{"success":false,"error":"TOO_MANY_REQUESTS","message":"Too many attempts. Wait a moment and try again."}
```

### `POST /api/auth/logout`

Requires a session cookie (any role). Clears the cookie.

**Response `200`:**
```json
{"success":true}
```
```
set-cookie: pharmassist_session=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
```

### `GET /api/auth/me`

Requires a session cookie.

**Response `200`:** same `{ user }` shape as login.

**No/expired cookie — `401`:**
```json
{"success":false,"error":"AUTH_EXPIRED","message":"Session expired or missing"}
```

### `GET /api/activity`

Any authenticated user. Query: `type?` (one of `dispense`, `prescription`,
`stop`, `restock`, `register`), `date?` (`YYYY-MM-DD`), `limit?` (default
50, max 200).

Request: `GET /api/activity?type=restock&limit=3`

**Response `200`:**
```json
[{"id":"cmsi7r8g90018g2l8p8vp6zjj","date":"2026-08-07","time":"00:35","type":"restock","drug":"Clopidogrel 75mg","text":"Restocked Clopidogrel 75mg — +200 tablets (Ref: PO-2026-0817)"}]
```

Every activity item is one flattened, human-readable text line plus a
`type` tag — there is no structured before/after diff.

### `GET /api/wards`

Any authenticated user. No query params.

**Response `200`:**
```json
[{"id":"cmsh37hy40003g2evlndr1kxz","code":"Ward 2D","name":"Oncology","label":"Ward 2D — Oncology","sweepStatus":"swept","activePatients":1},{"id":"cmsh37hx40000g2ev58fa6f2g","code":"Ward 4A","name":"General Medicine","label":"Ward 4A — General Medicine","sweepStatus":"swept","activePatients":2},{"id":"cmsh37hxs0001g2evaszb3fbq","code":"Ward 5B","name":"Cardiology","label":"Ward 5B — Cardiology","sweepStatus":"swept","activePatients":1},{"id":"cmsh37hxy0002g2evwjao5rvw","code":"Ward 6C","name":"Orthopaedics","label":"Ward 6C — Orthopaedics","sweepStatus":"swept","activePatients":1}]
```

A `nurse` gets the same shape, unfiltered — the ward list itself is not
scoped, only per-ward reads and writes are.

### `GET /api/wards/:id/pickup-list`

Any authenticated user, ward-scoped for nurses. Query: `date?`
(`YYYY-MM-DD`, defaults to today).

Request: `GET /api/wards/cmsh37hx40000g2ev58fa6f2g/pickup-list?date=2026-08-03`

**Response `200`** (pharmacist, after a dispense — see §"A realistic
sequence" below):
```json
{"wardId":"cmsh37hx40000g2ev58fa6f2g","wardCode":"Ward 4A","date":"2026-08-03","status":"dispensed","patients":[{"patientId":"cmsh37i8x001sg2evo2lx78tp","name":"Margaret Osei","mrn":"MRN-004821","bed":"Bed 04","medicines":[{"lineId":"cmshs2zzj000qg2su3o5rrorw","drug":"Amoxicillin 500mg","dose":"500mg","route":"Oral","qty":3,"treatmentDay":6,"durationDays":7,"status":"dispensed"},{"lineId":"cmshs2zzj000sg2suora1wz8t","drug":"Lisinopril 10mg","dose":"10mg","route":"Oral","qty":1,"treatmentDay":6,"durationDays":14,"status":"dispensed"},{"lineId":"cmshs2zzj000rg2su26vkkznm","drug":"Metformin 500mg","dose":"500mg","route":"Oral","qty":2,"treatmentDay":6,"durationDays":14,"status":"dispensed"}],"dispensed":true},{"patientId":"cmsh37ib20020g2evj9ny8okf","name":"James Kofi Antwi","mrn":"MRN-003145","bed":"Bed 07","medicines":[{"lineId":"cmshs2zzj000tg2suv8jdptqj","drug":"Furosemide 40mg","dose":"40mg","route":"Oral","qty":1,"treatmentDay":3,"durationDays":5,"status":"dispensed"},{"lineId":"cmshs2zzj000ug2suxoh8pork","drug":"Spironolactone 25mg","dose":"25mg","route":"Oral","qty":1,"treatmentDay":3,"durationDays":5,"status":"dispensed"}],"dispensed":true}]}
```

`qty` on each medicine line is **not** a field the caller sends or the
prescription stores — it is `dosesPerDay(frequency)` from
`packages/shared/src/frequency.ts` (`OD`→1, `BD`→2, `TDS`→3, `QDS`→4,
`ON`→1, `Weekly`→1, `PRN`/`STAT`→0, never swept), computed fresh every
sweep. There is no `daily_dosage_qty` field anywhere in this API.

**Nurse reading a ward that is not theirs — `403`:**
```json
{"success":false,"error":"FORBIDDEN","message":"You do not have access to that ward"}
```
(`a.owusu`, assigned to Ward 4A, requesting Ward 5B's pickup list.)

### `GET /api/patients`

Any authenticated user, ward-scoped for nurses. Query: `wardId?`, `search?`.

**Response `200`** (abridged to one patient; the live response returns
every admitted patient with their full prescription list embedded):
```json
{"id":"cmsh37i8x001sg2evo2lx78tp","mrn":"MRN-004821","name":"Margaret Osei","dateOfBirth":"1968-03-14","gender":"Female","phone":"+233 24 456 7890","ward":"Ward 4A","wardId":"cmsh37hx40000g2ev58fa6f2g","bed":"Bed 04","admissionDate":"2026-07-29","diagnosis":"Type 2 Diabetes Mellitus, Hypertension","allergies":"Penicillin","status":"admitted","prescriptions":[{"id":"cmsh37iac001wg2evyacjclkz","drugId":"cmsh37hyo0006g2ev2y1ovcpo","drug":"Metformin 500mg","dose":"500mg","route":"Oral","frequency":"BD","foodTiming":"with-food","timeOfDay":["morning","night"],"startDate":"2026-07-29","durationDays":14,"currentDay":10,"status":"active","notes":"Monitor blood glucose. Hold if eGFR falls below 30.","prescribedBy":"Dr. B. Kwame","prescribedAt":"2026-07-29T08:15:00.000Z"}]}
```

### `POST /api/patients`

Role: `nurse` or `pharmacist`. Body:

```json
{"name":"Yaw Boateng","dateOfBirth":"1990-05-12","gender":"Male","phone":"+233 20 111 2222","wardId":"cmsh37hx40000g2ev58fa6f2g","bed":"Bed 11","admissionDate":"2026-08-06","diagnosis":"Appendicitis, post-op","allergies":"None known"}
```

**Response `201`:**
```json
{"id":"cmsi7r8i8001ag2l8a4qhd9nu","mrn":"MRN-000006","name":"Yaw Boateng","dateOfBirth":"1990-05-12","gender":"Male","phone":"+233 20 111 2222","ward":"Ward 4A","wardId":"cmsh37hx40000g2ev58fa6f2g","bed":"Bed 11","admissionDate":"2026-08-06","diagnosis":"Appendicitis, post-op","allergies":"None known","status":"admitted","prescriptions":[]}
```

`mrn` is server-generated, not client-supplied — there is no `mrn` field
in the request body.

### `GET /api/patients/:id`

Any authenticated user, ward-scoped for nurses.

**Response `200`:** a single patient object, same shape as one entry of
`GET /api/patients`.

**Unknown id — `404`:**
```json
{"success":false,"error":"NOT_FOUND","message":"No patient found with id nonexistent-id-123"}
```

### `POST /api/patients/:id/prescriptions`

Role: `doctor`. Body:

```json
{"drugId":"cmsh37i08000hg2ev0ye789o3","dose":"400mg","route":"Oral","frequency":"BD","foodTiming":"after-food","timeOfDay":["morning","night"],"startDate":"2026-08-03","durationDays":5,"notes":"For post-op pain"}
```

`route` ∈ `Oral, IV, IM, SC, Topical, Inhaled`. `frequency` ∈ `OD, BD, TDS,
QDS, ON, Weekly, PRN, STAT`. `foodTiming` ∈ `before-food, after-food,
with-food, not-applicable`. `timeOfDay` is a non-empty array from
`morning, afternoon, evening, night`. `notes` is optional.

**Response `201`:**
```json
{"id":"cmsi7quzs000yg2l8pfghquw6","drugId":"cmsh37i08000hg2ev0ye789o3","drug":"Ibuprofen 400mg","dose":"400mg","route":"Oral","frequency":"BD","foodTiming":"after-food","timeOfDay":["morning","night"],"startDate":"2026-08-03","durationDays":5,"currentDay":5,"status":"active","notes":"For post-op pain","prescribedBy":"Dr. B. Kwame","prescribedAt":"2026-08-07T00:35:17.224Z"}
```

**Unknown `drugId` — `400`:**
```json
{"success":false,"error":"INVALID_INPUT","message":"No drug found with id not-a-real-drug-id"}
```
This is a 400, not a 404 — an invalid reference inside an otherwise
well-formed body is treated as a validation failure of the request, the
same as a Zod schema violation.

### `PATCH /api/prescriptions/:id`

Role: `doctor`. Body is any subset of the create-prescription fields
(only the sent fields change). Only an `active` prescription can be
edited.

Request:
```json
{"dose":"600mg","notes":"Increased dose per pain review"}
```

**Response `200`:**
```json
{"id":"cmsi7quzs000yg2l8pfghquw6","drugId":"cmsh37i08000hg2ev0ye789o3","drug":"Ibuprofen 400mg","dose":"600mg","route":"Oral","frequency":"BD","foodTiming":"after-food","timeOfDay":["morning","night"],"startDate":"2026-08-03","durationDays":5,"currentDay":5,"status":"active","notes":"Increased dose per pain review","prescribedBy":"Dr. B. Kwame","prescribedAt":"2026-08-07T00:35:17.224Z"}
```

Editing a non-active prescription returns `409 RX_NOT_ACTIVE` (same shape
as the stop-endpoint example below). An unknown id returns `404
RX_NOT_FOUND` rather than the generic `NOT_FOUND` code.

### `POST /api/prescriptions/:id/stop`

Role: `doctor`. Body: `{ "reason": string }`. Cancels any still-`pending`
indent lines for that prescription from today forward; lines already
dispensed are untouched.

Request:
```json
{"reason":"Pain resolved, discontinuing"}
```

**Response `200`:**
```json
{"id":"cmsi7quzs000yg2l8pfghquw6","drugId":"cmsh37i08000hg2ev0ye789o3","drug":"Ibuprofen 400mg","dose":"600mg","route":"Oral","frequency":"BD","foodTiming":"after-food","timeOfDay":["morning","night"],"startDate":"2026-08-03","durationDays":5,"currentDay":5,"status":"stopped","stopReason":"Pain resolved, discontinuing","notes":"Increased dose per pain review","prescribedBy":"Dr. B. Kwame","prescribedAt":"2026-08-07T00:35:17.224Z"}
```

**Stopping a prescription that is already stopped/completed — `409`:**
```json
{"success":false,"error":"RX_NOT_ACTIVE","message":"Prescription cmsh37ice0026g2eves88sbn0 is already stopped"}
```

### `GET /api/drugs`

Any authenticated user. Query: `search?` (matches name/label).

Request: `GET /api/drugs?search=amox`

**Response `200`:**
```json
[{"id":"cmsh37hy90004g2evapk0wsbp","label":"Amoxicillin 500mg","name":"Amoxicillin","strength":"500mg","form":"Capsule","category":"Antibiotics","unitPrice":0.85}]
```

### `GET /api/inventory`

Any authenticated user. Query: `category?`, `search?`.

**Response `200`** (one entry):
```json
{"id":"cmsh37i2l000yg2evijcfxerx","drugId":"cmsh37hzf000bg2evzjozxqlv","drug":"Clopidogrel 75mg","category":"Antiplatelets","unit":"Tablet","currentStock":7,"reorderLevel":50,"status":"critical"}
```

`status` is derived (`ok` / `critical`, comparing `currentStock` to
`reorderLevel`) — it is not a stored column the client can set.

### `GET /api/inventory/categories`

Any authenticated user.

**Response `200`:**
```json
["Analgesics","Antibiotics","Antidiabetics","Antiemetics","Antihypertensives","Antiplatelets","Beta-blockers","Cardiac glycosides","Corticosteroids","Diuretics","Lipid-lowering"]
```

### `POST /api/inventory/:drugId/restock`

Role: `pharmacist`. Body: `{ qty: positive integer, ref?: string }`.

Request:
```json
{"qty":200,"ref":"PO-2026-0817"}
```

**Response `200`:**
```json
{"id":"cmsh37i2l000yg2evijcfxerx","drugId":"cmsh37hzf000bg2evzjozxqlv","drug":"Clopidogrel 75mg","category":"Antiplatelets","unit":"Tablet","currentStock":207,"reorderLevel":50,"status":"ok"}
```

**Wrong role (nurse) — `403`:**
```json
{"success":false,"error":"FORBIDDEN","message":"This action requires one of: pharmacist"}
```

### `POST /api/indents/sweep`

Role: `pharmacist`. Body: `{ date?, wardId?, preview? }` — all optional;
an omitted `wardId` sweeps every ward, an omitted `date` sweeps today.
`preview: true` reports what the sweep would do without writing anything.

This is the daily job (also runs on a cron at 06:00) that turns each
active, due prescription into indent lines a ward can pick up. `qty` in
the resulting pickup list comes from here.

Request: `POST /api/indents/sweep` with `{"date":"2026-08-03","wardId":"cmsh37hxs0001g2evaszb3fbq","preview":true}`

**Response `200` (preview):**
```json
{"date":"2026-08-03","preview":true,"wards":[{"wardId":"cmsh37hxs0001g2evaszb3fbq","wardCode":"Ward 5B","indentId":"cmshs3009000wg2sujja4bwvl","lineCount":4,"patientCount":1,"status":"swept"}]}
```

**Response `200` (real, `preview` omitted):** identical shape with
`"preview":false`. Re-running a sweep for an already-swept day is safe —
it is idempotent, not an error.

### `POST /api/indents/dispense`

Role: `pharmacist`. Body: `{ patientId, wardId, date? }`. Fulfils every
still-pending indent line for that patient on that ward/date in one
transaction: decrements inventory, creates billing lines, and writes an
activity event.

Request:
```json
{"patientId":"cmsh37ib20020g2evj9ny8okf","wardId":"cmsh37hx40000g2ev58fa6f2g","date":"2026-08-03"}
```

**Response `200`:**
```json
{"patientId":"cmsh37ib20020g2evj9ny8okf","lines":2,"total":0.9}
```

**Dispensing the same patient/ward/date a second time — `409`:**
```json
{"success":false,"error":"BATCH_ALREADY_FULFILLED","message":"Medication for James Kofi Antwi was already dispensed on 2026-08-03"}
```

Insufficient stock for one of the required drugs returns `409
INSUFFICIENT_STOCK` instead — checked for every drug in the batch before
anything is written, so a shortfall never leaves a partial dispense.

### `GET /api/billing`

Any authenticated user, ward-scoped for nurses. Query: `wardId?`, `date?`.
Groups billing lines by patient.

Request: `GET /api/billing?date=2026-08-03`

**Response `200`** (one group):
```json
{"patientId":"cmsh37ib20020g2evj9ny8okf","patient":"James Kofi Antwi","ward":"Ward 4A","transactions":[{"id":"cmsi7q048000kg2l83k2wbk7m","batchId":"cmshs2zzb000pg2su9zjh3zra","patient":"James Kofi Antwi","ward":"Ward 4A","drug":"Furosemide 40mg","qty":1,"unitPrice":0.3,"total":0.3,"timestamp":"2026-08-07T00:34:37.208Z","status":"pending"},{"id":"cmsi7q04h000og2l8c778hvuu","batchId":"cmshs2zzb000pg2su9zjh3zra","patient":"James Kofi Antwi","ward":"Ward 4A","drug":"Spironolactone 25mg","qty":1,"unitPrice":0.6,"total":0.6,"timestamp":"2026-08-07T00:34:37.217Z","status":"pending"}],"total":0.9,"pendingCount":2,"billed":false}
```

### `POST /api/billing/confirm`

Role: `pharmacist`. Body: `{ patientId, date? }`. Marks every `pending`
billing line for that patient/date as `billed`.

Request:
```json
{"patientId":"cmsh37ib20020g2evj9ny8okf","date":"2026-08-03"}
```

**Response `200`:**
```json
{"patientId":"cmsh37ib20020g2evj9ny8okf","patient":"James Kofi Antwi","ward":"Ward 4A","transactions":[{"id":"cmsi7q048000kg2l83k2wbk7m","batchId":"cmshs2zzb000pg2su9zjh3zra","patient":"James Kofi Antwi","ward":"Ward 4A","drug":"Furosemide 40mg","qty":1,"unitPrice":0.3,"total":0.3,"timestamp":"2026-08-07T00:34:37.208Z","status":"billed"},{"id":"cmsi7q04h000og2l8c778hvuu","batchId":"cmshs2zzb000pg2su9zjh3zra","patient":"James Kofi Antwi","ward":"Ward 4A","drug":"Spironolactone 25mg","qty":1,"unitPrice":0.6,"total":0.6,"timestamp":"2026-08-07T00:34:37.217Z","status":"billed"}],"total":0.9,"pendingCount":0,"billed":true}
```

**Confirming the same patient/date a second time — `409`:**
```json
{"success":false,"error":"ALREADY_BILLED","message":"James Kofi Antwi's account was already billed"}
```

### A realistic sequence

The examples above for the indent/billing endpoints came from actually
running this sequence against the seeded data, as `k.asante` (pharmacist),
date `2026-08-03`, Ward 4A (`cmsh37hx40000g2ev58fa6f2g`):

1. `POST /api/indents/sweep` — generates the day's indent lines.
2. `GET /api/wards/:id/pickup-list?date=2026-08-03` — see what's due.
3. `POST /api/indents/dispense` for patient James Kofi Antwi — fulfils his
   pending lines, decrements stock, creates pending billing lines.
4. `GET /api/billing?date=2026-08-03` — his lines now show `"status":"pending"`.
5. `POST /api/billing/confirm` — marks them `"status":"billed"`.

Repeating step 3 or step 5 is what produces the `BATCH_ALREADY_FULFILLED`
and `ALREADY_BILLED` responses documented above.

---

## 6. Error envelope

Every error response — regardless of endpoint — has this shape:

```json
{ "success": false, "error": "CODE", "message": "human-readable detail" }
```

A validation failure from Zod concatenates every failing field into
`message`, e.g. `"drugId: Drug is required; timeOfDay: Pick at least one
time of day"`, under `INVALID_INPUT`.

| Code | HTTP status | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | Request body/query failed schema validation, or referenced an id (e.g. `drugId`) that doesn't exist in the catalog. |
| `AUTH_EXPIRED` | 401 | No session cookie, an invalid/expired one, or (reused) a failed login. |
| `FORBIDDEN` | 403 | Authenticated, but the role or ward doesn't permit this action. |
| `RX_NOT_FOUND` | 404 | No prescription with that id. |
| `RX_NOT_ACTIVE` | 409 | The prescription exists but isn't `active` (already `stopped` or `completed`) — cannot be edited or stopped again. |
| `NOT_FOUND` | 404 | Generic "no such record" (patient, ward, route). |
| `BATCH_ALREADY_FULFILLED` | 409 | That patient's indent lines for that ward/date were already dispensed. |
| `INSUFFICIENT_STOCK` | 409 | Not enough inventory for one or more drugs in the batch being dispensed. |
| `ALREADY_BILLED` | 409 | That patient's billing lines for that date were already confirmed. |
| `DATABASE_ERROR` | 409 | A transient transaction conflict (Postgres deadlock/timeout abort) — safe to retry. |
| `INTERNAL_ERROR` | 500 | Anything unexpected. Logged server-side; no internal detail is returned to the client. |
| `TOO_MANY_REQUESTS` | 429 | Login rate limit exceeded (20/min per username+IP). |

An unmatched route (wrong path or method) returns `404 NOT_FOUND` with
`message: "Route <METHOD> <URL> not found"`.

## 7. Money

Monetary values (`unitPrice`, `total`) are **JSON numbers with two decimal
places** (e.g. `0.85`, `3.77`), computed server-side from `Decimal`
columns — never a string, never a float the client is expected to round.
The currency is **GHS (Ghanaian cedi)** for every value in this API; it is
not carried in the payload, so an integrator hard-codes it rather than
looking for a `currency` field.

## 8. Dates and times

- Calendar days (`date`, `startDate`, `admissionDate`, `dateOfBirth`, etc.)
  are `YYYY-MM-DD` strings.
- Timestamps (`prescribedAt`, `timestamp`, `dispensedAt`, etc.) are full
  ISO-8601 (e.g. `2026-08-07T00:35:17.224Z`).
- Everything is **UTC**. There is no timezone parameter or per-user
  timezone conversion anywhere in the API — a `date` of `2026-08-03` means
  midnight UTC to midnight UTC.
