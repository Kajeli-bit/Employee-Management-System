# Nilric Employee Management System

A full-stack employee management system for **Nilric General Traders Company Limited**, built on the open-source EMS base (React, Vite, Node.js, Express, MongoDB Atlas, Clerk, Cloudinary) and extended with the company's organisation structure, richer employee profiles and GPS-based attendance.

---

## What this build adds

| Area | Change |
| --- | --- |
| Roles | Three roles: Managing Director, HR and Worker. The MD and HR run the management console; workers get a self-service portal. Retired chart roles (`general_manager`, `department_manager`, `team_lead`, `qshe_officer`, …) still resolve through a legacy map. |
| Departments | Seeded with the 6 departments and 8 teams from the organisation chart, including a two-level department/team tree. |
| Profiles | Employment, contact, statutory (NIN, TIN, NSSF), payroll, emergency contact and qualification fields, plus a reporting line. |
| Attendance | GPS check-in/check-out against geofenced work locations, attendance heartbeats and last on-site audit location, weekday/Saturday schedules, late/half-day rules, daily register and regularization. |
| Organisation chart | A live `/organisation` page for every user, with headcounts by role and department. |
| UI | IBM Plex typography, capability-driven navigation, TZS currency, Nilric login copy and attendance-first employee dashboard. |
| My workspace | The management console carries the signed-in manager's own dashboard, attendance and leave records under `/admin-dashboard/my`, so clocking in or applying for leave never leaves the console. |
| Worker workspace | The self-service dashboard uses a full-width content layout; account and sign-out actions live in its sidebar on desktop and mobile. |

---

## Roles and access

There are two workspaces, chosen by role.

| Role | Level | Scope | Workspace |
| --- | --- | --- | --- |
| Managing Director | 100 | Company | Management console **and** the worker portal. Everything: people, departments, salaries, attendance, locations, policy. The only role that can appoint HR. |
| HR | 90 | Company | Management console **and** the worker portal. Hiring, employee records, payroll, leave approvals, attendance and policy across every department. |
| Worker | 10 | Self | Worker portal only: dashboard, my attendance, apply for leave, my leaves, organisation chart, settings. |

`/admin-dashboard` requires the Managing Director or HR. Its sidebar ends with a **My workspace** group holding the manager's own pages: dashboard, attendance, leaves and apply for leave. They are mounted inside the console at `/admin-dashboard/my/...`, so a manager keeps the management navigation while clocking in or filing leave, and the personal pages work out of whichever shell opened them. `/employee-dashboard` is still the worker portal and stays open to every signed-in account. Workers are redirected away from management routes, and the API enforces the same rule independently.

Self-service salary, profile and account pages were removed from both workspaces; salary records are managed from the console's **Salary** screen. Login security lives on the settings page, reached by clicking your name and role at the bottom of the console sidebar (and on the worker portal's **Settings** link). The `/api/salary/my-salary` and `/api/employee/profile/me` endpoints are still mounted for future use.

Capabilities are defined once in [`server/utils/roles.js`](server/utils/roles.js) and mirrored in [`frontend/src/utils/roles.js`](frontend/src/utils/roles.js) for UI gating. Retired keys resolve through `LEGACY_ROLE_ALIASES`:

| Retired role | Becomes |
| --- | --- |
| `admin` | Managing Director |
| `general_manager`, `operations_manager`, `department_manager`, `manager` | HR |
| `qshe_officer`, `team_lead`, `tl`, `employee` | Worker |

An account still stored with a retired key keeps working immediately and is rewritten as the new key the next time its employee record is saved. To normalise every stored value at once, run `npm run migrate:roles` from `server/` (dry run) and then `npm run migrate:roles -- --apply`.

**Organisation structure**

```text
Managing Director
└── HR
    ├── Administration & Human Resource
    ├── Business Development ── Tender Team, Sales & Marketing Team
    ├── Technical ICT ── Technical ICT Team
    ├── Finance ── Finance Team
    ├── Medical Projects ── Medical Team
    └── Engineering ── Civil Engineering Team, Electrical & Telecommunication Team, Mechanical Engineering Team
```

The company's real reporting lines still live on each employee's `reportsTo` field and are shown on the organisation page; the access model above is deliberately simpler than the chart.

---

## GPS attendance

Attendance is recorded against a **company-local date** (`Africa/Dar_es_Salaam`, UTC+3), so a night shift that ends after midnight still lands on the correct day.

**Check-in**

1. The browser captures `latitude`, `longitude` and `accuracy` with `navigator.geolocation` (high accuracy).
2. The server finds the nearest active work location and measures the distance with the haversine formula.
3. Office staff must be inside the location radius (plus up to 40 m of GPS accuracy tolerance). Field and remote staff are recorded without a fence match and flagged accordingly.
4. Arrival after `workStart + graceMinutes` is marked **Late**. One record per employee per day is enforced by a unique index.
5. A manual absence record created by a manager is replaced when the employee actually clocks in.

**Check-out** records the exit position, computes worked minutes and marks a **Half Day** when the total is below the configured threshold. Check-out outside the fence is allowed (people leave site) but the distance is stored for review.

**Default policy** (editable on the Work locations screen by the MD or HR):

```text
workStart       08:00 (Monday–Friday)
workEnd         17:00 (Monday–Friday)
saturdayWorkStart 09:00
saturdayWorkEnd   13:00
sunday          non-working day
graceMinutes    15
halfDayMinutes  240
requireGeofence true
timezone        Africa/Dar_es_Salaam
autoClockOut    true   (weekdays: 15:30 / 16:45 / 17:00; Saturday: 11:30 / 12:45 / 13:00)
```

**Seeded head office** — `Nilric Head Office`, Plot 163/129, Apartment 107, Samora Avenue, Dar es Salaam at approximately `-6.8167, 39.2889`, radius 250 m. Replace the pin with the exact office coordinates from the Work locations screen ("Use my current location" while standing at the gate).

**Regularization** — managers with `attendance.manage` can set clock-in/out times, status and a reason for any employee they manage. The record is tagged `Manual` and stores who corrected it.

**Automatic clock-out** — a forgotten clock-out is resolved at the scheduled end of the working day. The system checks the most recent GPS heartbeat and the separately stored last on-site time (all in company-local time):

| Check | What it does |
| --- | --- |
| 15:30 — early departure (weekdays) | If an office worker's latest location is outside all active sites, the system stores the latest inside-site timestamp/location as the estimated departure, but leaves attendance open until 17:00. |
| 16:45 — presence check (weekdays) | If a recent location is available, the record is queued for 17:00. If no recent position arrived, the record stays open for review instead of guessing. |
| 17:00 — close (weekdays) | Queued records are automatically clocked out at 17:00. Early departures retain the actual last-seen-on-site time in the automatic clock-out reason and audit trail. |
| 11:30 — early departure (Saturday) | A location outside all active sites queues an automatic close at 13:00 while preserving the last on-site time/location. |
| 12:45 — presence check (Saturday) | A recent location queues a close at 13:00. No recent position leaves the record open for review. |
| 13:00 — close (Saturday) | Queued Saturday attendance is closed at 13:00. Sundays are non-working days and are skipped by the scheduled attendance sweep. |

How it gets a position: while a day is open, the employee app posts its position to `POST /api/attendance/heartbeat` every five minutes. A browser can only read a location while the page is open and permission has been granted, so a closed tab or laptop lid means no new reading; a day without enough recent evidence is left open for review. The system preserves the latest location and separately tracks the full last fix inside a worksite. For example, a worker who leaves at 15:20 may be automatically clocked out at 17:00; the checkout record carries the last on-site GPS fix/time, and the reason states that 15:20 was the last time seen inside. If the device reports back inside the worksite before the close, the early-departure queue is canceled and the scheduled-end presence check decides whether to close the day.

Field and remote staff are never closed early for being away from the office. With recent location evidence, their open attendance is closed at the scheduled end: 17:00 on weekdays or 13:00 Saturday. Sundays are non-working days.

The weekday times derive from `workEnd`, so a company finishing at 18:00 checks at 16:30, 17:45 and 18:00. Saturday defaults are `saturdayWorkStart` 09:00 and `saturdayWorkEnd` 13:00; attendance policy fields `earlyDepartureCheckMinutes` (default 90) and `autoClockOutConfirmMinutes` (default 15) apply relative to that day's end as well. MD or HR can edit the Saturday hours on Work locations → Attendance policy. Sunday clock-in is rejected and automatic sweeps do not process Sunday records.

**Scheduling** — every heartbeat also runs the check for that company, so an open employee app keeps the schedule moving. For days when nobody has the app open, the same check runs from a scheduler: set `CRON_SECRET` on the server, then either let the included GitHub Actions workflow call `GET /api/cron/attendance` every ten minutes (set the `ATTENDANCE_SWEEP_URL` repository variable to `https://<your-domain>/api/cron/attendance` and `ATTENDANCE_CRON_SECRET` to the same secret), or point any cron service at that URL with the same header. Vercel's own cron jobs are limited to once a day on the Hobby plan, which is why the schedule is not in `vercel.json`.

---

## Adding an employee

Adding someone takes one screen and three fields: **full name, work email and phone number**. Nothing else is asked for.

On save the server creates the Clerk login, derives the username from the email (adding `2`, `3`… when it is taken), generates the staff ID (`NIL-YY-NNNN`) and sets the role to Worker. The email becomes the sign-in address; the worker signs in with a one-time code, never a password.

Everything else lives on the profile, which HR fills in from **Employees → open → Edit**. The editor keeps five steps: **Identity → Position → Contacts & emergency → Statutory & documents → Access & review**, and nothing in it is mandatory, so a record can be completed a field at a time. That is where department, supervisor, salary, home site, dates, statutory numbers and documents are added.

- **Roles follow the seniority ladder.** The picker shows all three roles horizontally from senior to junior: Managing Director → HR → Worker (on narrow screens, it stacks into one column). Roles at or above the signed-in user's level remain visible but locked; the server enforces that only lower-level roles can be assigned. The MD can assign HR or Worker, while HR can assign Worker only.
- **Access preview.** Selecting a role shows its description, level, scope and the capabilities it grants (payroll, leave approval, attendance review) before the change is saved.
- **Role and designation stay aligned.** Choosing Managing Director, HR or Worker updates the designation to Managing Director, Human Resource Manager or Worker, respectively. Department/team remains a separate placement choice.
- **Suggestions, not guesses.** The employee ID has a generator (`NIL-YY-NNNN`), and the supervisor defaults to the most senior person in the chosen department.

## Recent workspace and attendance updates

- The worker portal uses the available page width, with account settings and sign-out in its sidebar on desktop and mobile; the management-console layout is unchanged.
- Attendance heartbeats preserve the latest position and full last on-site GPS fix. An office employee who leaves early remains clocked in until 17:00 on weekdays or 13:00 on Saturday; the recorded checkout carries the last on-site time/location for audit.
- Standard hours are 08:00–17:00 Monday–Friday and 09:00–13:00 Saturday. Sunday is a non-working day: check-ins are rejected and automatic sweeps are skipped.
- See [GPS attendance](#gps-attendance) for early-departure confirmation, automatic close, and scheduler behavior.

## Employee profile fields

Existing fields: employee ID, department, designation, salary, date of birth, gender, marital status, profile photo (Cloudinary).

Added:

- Employment: type (full-time, part-time, contract, intern, casual), status (active, probation, on leave, suspended, exited), date joined, probation end, contract end, attendance mode (office, field, remote), home site (`workLocation`, used for reporting — GPS attendance still accepts any active Nilric location), supervisor (`reportsTo`). Department and salary are optional on the employee record, so a worker can be onboarded with just name, email and phone and placed later.
- The `User` still carries the old `companyScope` flag for backwards compatibility; with company-wide HR it no longer changes anyone's access.
- Contact: phone, personal email, address, city, region.
- Statutory and payroll: national ID (NIN), TIN, NSSF number, NHIF / SHA number, bank name, bank branch, account name, account number.
- Identification documents: driving licence, passport number, work permit expiry.
- Emergency contact: name, relationship, phone.
- Qualifications: highest qualification, field of study, certifications, skills, notes.

The employee's role lives on the `User` record; all other profile data lives on `Employee`. Salary records and leave records continue to reference the employee.

Profile parsing (which fields are accepted, how lists and the emergency contact are shaped, and who may set the legacy visibility flag) lives in [`server/utils/employeeProfile.js`](server/utils/employeeProfile.js) and is unit-tested.

---

## API

All endpoints require a Clerk session token (`Authorization: Bearer <token>`), and every query is scoped by `companyId`. The single exception is the unauthenticated liveness probe below.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness probe; returns `{ success, status, uptime }` without touching the database |

### Attendance

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/attendance/today` | Today's record, policy, active locations and the caller's attendance mode |
| POST | `/api/attendance/check-in` | `{ latitude, longitude, accuracy }` |
| POST | `/api/attendance/check-out` | `{ latitude, longitude, accuracy }` |
| POST | `/api/attendance/heartbeat` | `{ latitude, longitude, accuracy }` — position report while a day is open (feeds automatic clock-out) |
| POST | `/api/attendance/sweep` | Run the automatic clock-out check now (management) |
| GET | `/api/cron/attendance` | Scheduled automatic clock-out check; needs `Authorization: Bearer $CRON_SECRET` |
| GET | `/api/attendance/me?from=&to=` | Last 30 days by default, with a summary |
| GET | `/api/attendance?date=&department=&status=` | Daily register (management, scoped) |
| POST | `/api/attendance/mark` | Regularize/create a record |
| PATCH | `/api/attendance/:id` | Change status or note |

### Work locations and policy

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/locations` | Active locations; managers can request inactive ones |
| POST / PUT | `/api/locations` `/api/locations/:id` | Create or edit a geofence |
| DELETE | `/api/locations/:id` | Deactivate (history is preserved) |
| GET / PUT | `/api/locations/policy` | Read or update the attendance policy |

### Organisation

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/org/structure` | Department tree, headcounts, role counts, job titles |
| GET | `/api/org/supervisors` | Possible supervisors for the caller |

Existing endpoints for employees, departments, salary, leave and dashboard remain, now enforcing the new hierarchy, department scope and capabilities.

---

## Getting started

### Requirements

- Node.js 20+ (verified on Node 24)
- MongoDB Atlas connection string (transactions are used for company registration, so a replica set is required — Atlas provides this by default)
- Clerk publishable/secret keys
- Optional: Cloudinary account for employee photos

### Backend

```bash
cd server
npm install
cp .env.example .env   # then fill in the values
npm start              # http://localhost:5000
```

Database selection is pinned by the runtime, not inferred from the Atlas URI:
local API processes connect to **`test`** and Vercel deployments connect to
**`ems`**. Keep the same Atlas cluster URI in both environments; its path must
not specify another database. The normal runtime cannot override this split.
The migration command below is an explicit exception that reads from `test`
and writes to `ems` only when run with `--apply`.

`server/.env`:

```env
ATLASDB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/
JWT_KEY=your_jwt_secret
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLIENT_URL=http://localhost:5173
PORT=5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

The localhost frontend calls the local API, which is pinned to the `test`
database. In Vercel Project → Settings → Environment Variables, set
`ATLASDB_URL` for **Production** to the Atlas URI used to reach the `ems`
database (the app selects `ems` itself), and set production `CLIENT_URL` to
the deployed app's exact origin. Do not use the production API URL or production
database configuration in local frontend `.env` files. After changing Vercel
environment variables, redeploy the production deployment for the new values to
be applied.

`frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

> The app throws on startup without `VITE_CLERK_PUBLISHABLE_KEY`. Vite statically evaluates that check, so a production build without the variable will tree-shake the entire app away. Always build with the variable set (or a populated `.env`).

### First run

Registering a company creates:

1. the company and the Managing Director user,
2. all Nilric departments and teams,
3. the head-office work location,
4. an employee record for the Managing Director, so they appear on the chart and can clock in.

Structure changes reach existing companies without deleting anything. Departments
and teams are matched by key and updated in place; only empty units that no
longer exist in the defaults are removed, and units that still hold employees
are kept and reported:

```bash
cd server
npm run seed:org
```

---

## Project structure

```text
server/
├── controllers/
│   ├── attendanceController.js    GPS check-in/out, register, regularization
│   ├── locationController.js      Work locations + attendance policy
│   ├── orgController.js           Org structure and supervisor directory
│   └── ...                        Existing auth, employee, salary, leave, department
├── models/
│   ├── Attendance.js              One record per employee per local date
│   ├── WorkLocation.js            Geofenced sites
│   └── ...
├── utils/
│   ├── roles.js                   Role catalogue, levels, capabilities
│   ├── geo.js                     Haversine, geofence, company-time helpers
│   ├── access.js                  Department/company scoping
│   └── orgDefaults.js             Nilric departments, teams, head office
├── tests/                         node:test suites for roles and geo
└── seedOrg.js                     Structure sync for existing companies

frontend/src/
├── components/
│   ├── attendance/                MyAttendance, AttendanceRegister, WorkLocations
│   ├── org/OrgChart.jsx           Live organisation page
│   └── employee/EmployeeForm.jsx  Shared create/edit profile form
└── utils/
    ├── roles.js                   Frontend mirror of the role catalogue
    └── format.js                  TZS, dates, clock times, distance
```

---

## Checks

```bash
cd server && npm test               # Node test suite, including database-backed automation cases
cd frontend && npm run build        # production build (needs VITE_CLERK_PUBLISHABLE_KEY)
cd frontend && npm run lint         # currently reports pre-existing lint errors
```

`npm test` runs Node's built-in test runner:

- `tests/geo.test.js`, `tests/roles.test.js` — pure functions: haversine and fence tolerance, the Dar es Salaam calendar, the three-role hierarchy, role capabilities, the legacy role map and which roles may assign which.
- `tests/employeeProfile.test.js` — profile-field whitelist (payroll numbers submitted as profile data are ignored), list and emergency-contact parsing, boolean handling, the visibility rule, and that the public role catalogue carries the tier, scope and description the picker needs.
- `tests/orgStructure.test.js` — fresh seeding plus the structure sync: six departments and eight teams for a new company, renames/reparents/prunes on a legacy company, and that units holding employees are kept.
- `tests/departments.test.js` — department registration with teams in one call (parent links, rollback on bad input) and the detail endpoint returning its teams.
- `tests/attendance.integration.test.js` — the real attendance controller against a temporary MongoDB (`mongodb-memory-server`), so the unique index and atomic upserts are exercised rather than mocked. Covers an in-fence check-in, a rejected fix 12 km away that stores nothing, field staff clocking in off-site, duplicate punches, check-out without check-in, half-day and full-day settlement, a GPS punch replacing a manager's absence record, exited employees, and that a department manager cannot widen their register by passing another department in the query. The test calls the controller with a fake Express request/response, so it needs no Clerk keys and no running database; the first run downloads a MongoDB binary once, which is the only step that requires network access.

---

## Security notes

- Permissions are enforced on the server; the UI only hides what the API already rejects.
- Company isolation: attendance, locations, employees, salaries and leaves all filter by `companyId`.
- Browser origins: set `CLIENT_URL` in production (comma separated) to pin which sites may call the API. Left blank, any origin is allowed so localhost and LAN testing work.
- Workspace isolation: workers are redirected away from `/admin-dashboard`, and every management endpoint checks a capability the worker role does not have.
- HR cannot appoint or edit another HR account; only the Managing Director can. Neither the MD nor HR can edit their own employee record through the admin screens (profile editing is self-service).
- GPS is a deterrent, not proof: a determined user can spoof coordinates. Add device binding, selfie verification or supervisor confirmation if attendance is used for payroll deductions. Require HTTPS in production — browsers block geolocation on insecure origins (except `localhost`).
- Do not commit `.env` files, Clerk keys or Cloudinary secrets. Restrict the Vercel production MongoDB user's network access and permissions to the production cluster/database as appropriate; never expose `ATLASDB_URL` to the frontend.
- The application backend, role migration and organisation seeding default to `test` locally and always pin Vercel to `ems`. The explicit `migrate:test-to-ems -- --apply` command is the only supported cross-database path.
