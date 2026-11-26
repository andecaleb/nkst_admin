# NKST Admin Frontend — Test Cases Specification

Covers all functional, integration, and security scenarios from `01-auth-and-permissions-shell.md` through `05-e2e-verification-checklist.md`.

## 1. Unit Test Cases (`tests/unit/`)

| ID | Area | Scenario | Expected Result |
| --- | --- | --- | --- |
| UT-01 | API Client | JSON:API 1.1 success envelope (`{ jsonapi, data, meta }`) | Unwraps `data` and preserves `meta` |
| UT-02 | API Client | JSON:API 1.1 error envelope (`errors[].detail`) | Throws `ApiError` with normalized status & details |
| UT-03 | API Client | `401 Unauthorized` with valid `refreshToken` | Calls `/auth/refresh` once, updates tokens, retries original request |
| UT-04 | API Client | `401 Unauthorized` when refresh fails | Clears localStorage tokens and throws `401` |
| UT-05 | Auth & Permissions | `can(permissionKey)` check | Returns `true` only if `permissionKey` is in hydrated `permissions[]` |
| UT-06 | Auth & Permissions | `branch.super_admin` vs `isHqAdmin` | Holding `branch.super_admin` never sets `isHqAdmin = true` |
| UT-07 | Auth & Permissions | Admin Shell Gate | Allows HQ Admin, Church Admin, Group Admin, or delegated leader with ≥1 permission; blocks plain `MEMBER` |
| UT-08 | Positions Utils | Seat mode mapping (`single` / `limited` / `unlimited`) | Maps to `maxSeats: 1`, `maxSeats: N >= 1`, `maxSeats: null` |
| UT-09 | Positions Utils | Eligible assignee filtering | Excludes members already in `holders[]` |
| UT-10 | Member Import | Phone normalization & duplicate check | Normalizes `080...`, `234...`, `+234...` to identical `+234...` and flags in-file duplicates |

## 2. Integration Test Cases (`tests/integration/`)

| ID | Area | Scenario | Expected Result |
| --- | --- | --- | --- |
| IT-01 | HQ Positions | HQ Admin views `/hq/positions` | Displays seeded positions with `S/No.`, `seatLabel`, `Active`/`Inactive` badge, `branchesUsingCount` |
| IT-02 | HQ Positions | Create duplicate position (`"senior pastor"`) | Inline `409 Conflict` alert displayed inside modal |
| IT-03 | HQ Positions | Lower `maxSeats` below active branch count | Verbatim `400 Bad Request` listing affected branches displayed in Edit modal |
| IT-04 | HQ Positions | Deactivate position | Confirmation modal shows required warning; calls `PATCH .../deactivate` |
| IT-05 | HQ Positions | Delete button guard | Disabled when `activeAssignmentsCount > 0` |
| IT-06 | Branch Positions | View positions & capacity badges | Renders `2 / Unlimited` and `1 / 1 filled`; disables Add Member button with full-capacity caption when `isFull` |
| IT-07 | Branch Positions | Assign eligible member | Picker excludes existing holders; `POST /branch/positions/:id/assignments` sends only `{ memberId }` |
| IT-08 | Branch Positions | Remove holder with last-admin protection (`400`) | Shows confirmation modal and displays inline `400` error when blocked |
| IT-09 | Position Permissions | Dynamic catalog checklist & `branch.super_admin` warning | Renders items from `/permission-catalog`; shows warning callout on `branch.super_admin`; saves via `PUT` and refetches `my-permissions` |
| IT-10 | Members & Verification | Delegated Catechism Leader (`members.verify` only) | Accesses `/verification`, verifies & unverifies members; does NOT see Edit Member or Position Permissions |
| IT-11 | Messages | Flagged message approval & rejection | Displays crimson `Flagged` badge + `matchedKeywords` pills; approve/reject calls exact endpoints |

## 3. Security Test Cases (`tests/security/`)

| ID | Area | Attack / Isolation Scenario | Expected Result |
| --- | --- | --- | --- |
| ST-01 | HQ Isolation | Church Admin or `branch.super_admin` inspects sidebar | **HQ Positions** and **Audit Logs** are never rendered |
| ST-02 | HQ Route Guard | Church Admin or `branch.super_admin` navigates directly to `/hq/positions` | Blocked with `403 Forbidden — HQ Platform Admin Only` and zero HQ API calls |
| ST-03 | Permission Escalation | User with only `positions.assign` navigates to `/branch/permissions` | Blocked with `403 Forbidden — Branch Super Admin Required` |
| ST-04 | Least Privilege | Catechism Leader (`members.verify` only) navigates to `/members` | Blocked with `403 Forbidden` (no `members.view`); cannot render Edit Member drawer |
| ST-05 | Branch Isolation Payload | Branch assignment (`POST`) & permission update (`PUT`) requests | Request JSON bodies NEVER contain `branchId` or `churchId` |
| ST-06 | Immediate Revocation | `branch.super_admin` revoked and `my-permissions` refreshed | Privileged nav items and `/branch/permissions` access are immediately removed |
