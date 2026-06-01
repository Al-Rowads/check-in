# Event Check-In Desk

A frontend-only React + TypeScript SPA for importing an event roster from Excel or CSV, searching guests at a check-in desk, and tracking whether each guest has entered or left.

## Setup

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Login

Prototype credentials are configured in `src/config/auth.ts`.

Default credentials:

```text
Username: admin
Password: checkin2026
```

This is frontend-only authentication stored in the browser. It is not secure for production because users can inspect bundled code and local storage. A production version should replace this with backend authentication, server-side sessions or short-lived tokens, authorization checks, audit logging, and protected import/check-in APIs.

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

Guests with incomplete payment can be marked as paid from the guest row actions. This updates the payment badge, incomplete payment statistic, and `Not fully paid` filter immediately.

## Search Behavior

- Name searches are case-insensitive and tolerate extra spaces.
- First-name searches show all guests with that first name.
- Partial name searches match the normalized full name.
- Phone-like searches use exact matching after removing whitespace, dashes, parentheses, and plus signs.

## Persistence

Imported guests and check-in states are persisted in `localStorage`, so refreshing the browser keeps the roster and current states. Browser storage is local to that device and can be cleared by the user or browser settings.

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
