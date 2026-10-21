# Nilric Employee Management System

A full-stack employee management system for **Nilric General Traders Company Limited**, built on the open-source EMS base (React, Vite, Node.js, Express, MongoDB Atlas, Clerk, Cloudinary) and extended with the company's organisation structure, richer employee profiles and GPS-based attendance.

---

## What this build adds

| Area | Change |
| --- | --- |
| Roles | Replaced the generic `admin / manager / hr / tl / employee` roles with the Nilric structure: Managing Director, General Manager, Operations Manager, QSHE Officer, Department Manager, Team Lead, Employee. Permissions are level- and scope-based. |
| Departments | Seeded with the 6 departments and 8 teams from the organisation chart, including a two-level department/team tree. |
| Profiles | Employment, contact, statutory (NIN, TIN, NSSF), payroll, emergency contact and qualification fields, plus a reporting line. |
| Attendance | GPS check-in/check-out against geofenced work locations, late/half-day rules, daily register, regularization and per-employee history. |
| Organisation chart | A live `/organisation` page for every user, with headcounts by role and department. |
| UI | IBM Plex typography, capability-driven navigation, TZS currency, Nilric login copy and attendance-first employee dashboard. |

---

## Roles and access

Levels follow the reporting lines in the organisation chart. A role can only manage roles with a lower level, and department-scoped roles only act inside their own department.

| Role | Level | Scope | Can do |
| --- | --- | --- | --- |
| Managing Director | 100 | Company | Everything: people, departments, salaries, attendance, locations, policy. Cannot apply for leave (company head). |
| General Manager | 95 | Company | Same as MD, plus leave applications. |
| Operations Manager | 90 | Company | Company-wide people, departments, salaries, attendance, locations and policy. |
| QSHE Officer | 85 | Company | Read-only people/departments/attendance plus compliance oversight. Independent of operations. |
| Department Manager | 80 | Their department | Add/edit employees and leads in their department, salaries, leave approvals, attendance and regularization. |
| Team Lead | 60 | Their department | View the team, approve leave, review attendance. No salary or hiring rights. |
| Employee | 10 | Self | Clock in/out, apply for leave, view own profile and salary, view the org chart. |

Capabilities are defined once in [`server/utils/roles.js`](server/utils/roles.js) and mirrored in [`frontend/src/utils/roles.js`](frontend/src/utils/roles.js) for UI gating. Legacy accounts using `admin`, `manager`, `hr` or `tl` are still recognised and mapped to their closest new role.

**Organisation structure**

```text
Managing Director
└── General Manager
    ├── QSHE Officer (oversight)
    └── Operations Manager
        ├── Administration & Human Resource
        ├── Business Development ── Tender Team, Sales & Marketing Team
        ├── Technical ICT ── Technical ICT Team
        ├── Finance ── Finance Team
        ├── Medical Projects ── Medical Team
        └── Engineering ── Civil Engineering Team, Electrical & Telecommunication Team, Mechanical Engineering Team
```

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

**Default policy** (editable on the Work locations screen by MD / GM / Operations Manager):

```text
workStart       08:00
workEnd         17:00
graceMinutes    15
halfDayMinutes  240
requireGeofence true
timezone        Africa/Dar_es_Salaam
```

**Seeded head office** — `Nilric Head Office`, Plot 163/129, Apartment 107, Samora Avenue, Dar es Salaam at approximately `-6.8167, 39.2889`, radius 250 m. Replace the pin with the exact office coordinates from the Work locations screen ("Use my current location" while standing at the gate).

**Regularization** — managers with `attendance.manage` can set clock-in/out times, status and a reason for any employee they manage. The record is tagged `Manual` and stores who corrected it.

---

## Employee profile fields

Existing fields: employee ID, department, designation, salary, date of birth, gender, marital status, profile photo (Cloudinary).

Added:

- Employment: type (full-time, part-time, contract, intern, casual), status (active, probation, on leave, suspended, exited), date joined, contract end, attendance mode (office, field, remote), supervisor (`reportsTo`).
- Contact: phone, personal email, address, city, region.
- Statutory and payroll: national ID (NIN), TIN, NSSF number, bank name, account name, account number.
- Emergency contact: name, relationship, phone.
- Qualifications: highest qualification, field of study, certifications, skills, notes.

The employee's role lives on the `User` record; all other profile data lives on `Employee`. Salary records and leave records continue to reference the employee.

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

`server/.env`:

```env
ATLASDB_URL=mongodb+srv://...
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
cd server && npm test               # 32 tests: 14 unit, 18 database-backed
cd frontend && npm run build        # production build (needs VITE_CLERK_PUBLISHABLE_KEY)
cd frontend && npm run lint         # currently reports pre-existing lint errors
```

The repo had no test suite before. `npm test` runs Node's built-in test runner:

- `tests/geo.test.js`, `tests/roles.test.js` — pure functions: haversine and fence tolerance, the Dar es Salaam calendar, role levels, capabilities and department scope.
- `tests/orgStructure.test.js` — fresh seeding plus the structure sync: six departments and eight teams for a new company, renames/reparents/prunes on a legacy company, and that units holding employees are kept.
- `tests/departments.test.js` — department registration with teams in one call (parent links, rollback on bad input) and the detail endpoint returning its teams.
- `tests/attendance.integration.test.js` — the real attendance controller against a temporary MongoDB (`mongodb-memory-server`), so the unique index and atomic upserts are exercised rather than mocked. Covers an in-fence check-in, a rejected fix 12 km away that stores nothing, field staff clocking in off-site, duplicate punches, check-out without check-in, half-day and full-day settlement, a GPS punch replacing a manager's absence record, exited employees, and that a department manager cannot widen their register by passing another department in the query. The test calls the controller with a fake Express request/response, so it needs no Clerk keys and no running database; the first run downloads a MongoDB binary once, which is the only step that requires network access.

---

## Security notes

- Permissions are enforced on the server; the UI only hides what the API already rejects.
- Company isolation: attendance, locations, employees, salaries and leaves all filter by `companyId`.
- Browser origins: set `CLIENT_URL` in production (comma separated) to pin which sites may call the API. Left blank, any origin is allowed so localhost and LAN testing work.
- Department isolation: department managers and team leads are pinned to their own department (including its teams) for employee, attendance, leave and salary actions.
- The company head (Managing Director) cannot apply for leave or edit their own employee record through the admin screens.
- GPS is a deterrent, not proof: a determined user can spoof coordinates. Add device binding, selfie verification or supervisor confirmation if attendance is used for payroll deductions. Require HTTPS in production — browsers block geolocation on insecure origins (except `localhost`).
- Do not commit `.env` files, Clerk keys or Cloudinary secrets.
