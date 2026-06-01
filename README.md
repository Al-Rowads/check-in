# Event Check-In Desk

A React + TypeScript check-in desk with a Node host server for importing an
event roster from Excel, CSV, or Google Sheets, searching guests, and tracking
whether each guest has entered or left.

## Setup

```bash
npm install
npm run dev
```

To run with host-side persistence:

```bash
npm run host
```

This builds the app, starts the Node host server, and saves roster data under
`data/` by default. Use `HOST=0.0.0.0 npm run host` if other devices on the
same trusted network need to open the check-in desk. Use `CHECKIN_DATA_DIR` to
store the data somewhere else.

To start with a public Google Sheets roster already configured:

```bash
CHECKIN_GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/..." npm run host
```

## Docker

Build and run the container directly:

```bash
docker build -t event-check-in .
docker run --rm -p 4173:4173 -v "$PWD/data:/app/data" event-check-in
```

Or use Docker Compose:

```bash
docker compose up --build
```

The app is available at `http://localhost:4173`. Container data is stored in
`/app/data`; the Compose file maps that to `./data` on the host so roster files,
Google Sheets sync state, and check-in changes survive restarts.

Runtime settings can be passed as environment variables:

```bash
docker run --rm -p 4173:4173 \
  -v "$PWD/data:/app/data" \
  -e CHECKIN_ADMIN_PASSWORD="change-me" \
  -e CHECKIN_USER_PASSWORD="change-me-too" \
  -e CHECKIN_GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/..." \
  event-check-in
```

### Nginx reverse proxy

An example host-level Nginx config is available at
`deploy/nginx/event-check-in.conf`. Replace `checkin.example.com` with your
domain and make sure the certificate paths match your TLS certificate.

When Nginx is the public entry point, bind the Docker port to localhost so the
Node server is not exposed directly:

```yaml
ports:
  - "127.0.0.1:4173:4173"
```

Then install the config on the server:

```bash
sudo cp deploy/nginx/event-check-in.conf /etc/nginx/sites-available/event-check-in.conf
sudo ln -s /etc/nginx/sites-available/event-check-in.conf /etc/nginx/sites-enabled/event-check-in.conf
sudo nginx -t
sudo systemctl reload nginx
```

The config proxies traffic to `http://127.0.0.1:4173`, redirects HTTP to HTTPS,
and sets `client_max_body_size 30m` so Excel/CSV roster uploads work through
Nginx.

For a production build:

```bash
npm run build
npm run preview
```

## Login and Roles

Prototype credentials are configured in `src/config/auth.ts`.

Default admin credentials:

```text
Username: admin
Password: checkin2026
```

Default normal user credentials:

```text
Username: user
Password: user2026
```

Admins can upload roster files and configure Google Sheets sync. Normal users
can search guests and update check-in/payment state, but cannot upload files,
configure sheet links, add roster entries, or edit roster details.

With `npm run host`, the host API also enforces these roles. The static
credentials can be overridden with `CHECKIN_ADMIN_USERNAME`,
`CHECKIN_ADMIN_PASSWORD`, `CHECKIN_USER_USERNAME`, and `CHECKIN_USER_PASSWORD`.

This is still prototype authentication. A production version should replace this
with hardened backend authentication, server-side sessions or short-lived
tokens, audit logging, HTTPS, and protected deployment/network boundaries.

## Excel or CSV Format

Supported files: `.xlsx`, `.xls`, and `.csv`.

For the current CSV format, use:

```csv
name,phone,value,payment,statement
طه كريم جابر,7721968342,500,باقي مبلغ,
علي عبد الكريم,7704888200,700,دفع كامل,
عمر مصطفى,7727677205,vip,دفع كامل,
```

The CSV can also be imported without the header row, in the same column order:
`name, phone, value, payment, statement`.

The old `status` column is no longer used for CSV imports. Guest status is derived from
`value`: `vip` creates a VIP guest; any other non-empty value creates a normal guest and
is shown on the guest row as `Value`.

Required fields:

| Field | Accepted column names | Required values |
| --- | --- | --- |
| Name | `name`, `full name`, `guest name`, `attendee name` | Any non-empty full name |
| Phone number | `phone`, `phone value`, `phone number`, `mobile`, `mobile number` | Any non-empty phone number |
| Value | `value`, `amount`, `amount paid`, `paid amount` | `vip` for VIP, or any other non-empty value for normal |
| Payment | `payment`, `statement`, `payment statement`, `payment status`, `paid status` | `full`, `not fully paid`, `دفع كامل`, or `باقي مبلغ` |

The importer normalizes headers, trims extra whitespace, validates required values, and allows duplicate rows or duplicate phone numbers.

Uploading a roster refreshes the active guest list instead of appending to the
previous import. Guests with the same normalized phone number and name keep their
check-in state, timestamps, and any payment marked as full in the app.

With `npm run host`, a public Google Sheets link can also be synced from the
roster panel. The host downloads the sheet as CSV immediately, then downloads it
again every 5 minutes. The sheet must use the same columns as CSV imports.

Guests with incomplete payment can be marked as paid from the guest row actions. This updates the payment badge, incomplete payment statistic, and `Not fully paid` filter immediately.

## Search Behavior

- Name searches are case-insensitive and tolerate extra spaces.
- First-name searches show all guests with that first name.
- Partial name searches match the normalized full name.
- Phone-like searches use exact matching after removing whitespace, dashes, parentheses, and plus signs.

## Persistence

When the app is served with `npm run host`, uploaded rosters and guest changes
are persisted on the host filesystem:

- `data/guests.json` stores the active guest state used by the app.
- `data/active-roster.csv` stores the active roster with payment/check-in changes.
- `data/latest-upload.*` stores the latest uploaded source file.
- `data/uploads/` stores timestamped uploaded roster history.
- `data/latest-google-sheet.csv` stores the latest downloaded Google Sheet CSV.
- `data/google-sheet-downloads/` stores timestamped Google Sheet download history.
- `data/google-sheet-sync.json` stores the configured public sheet link and last sync status.

If the host API is unavailable, the app falls back to `localStorage`. Browser
storage is local to that device and can be cleared by the user or browser
settings. The prototype login is still frontend-only, so run host persistence
only on a trusted network or behind a real authenticated backend.

Google Sheets sync settings:

```bash
CHECKIN_GOOGLE_SHEET_SYNC_INTERVAL_MS=300000
CHECKIN_GOOGLE_SHEET_FETCH_TIMEOUT_MS=15000
```

## Checks

```bash
npm run typecheck
npm run test
npm run build
```

## Future Backend Upgrade

- Move authentication and authorization to a backend.
- Store rosters and check-in events in a database.
- Add import audit logs and per-admin activity history.
- Add server-side duplicate handling and validation.
- Support multiple check-in devices with real-time synchronization.
- Export final attendance reports.
