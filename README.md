# NKST Digital Platform — Admin Console

Next.js (App Router) + TypeScript + Tailwind CSS administrative frontend for the **NKST Digital Platform**, connected to the NestJS backend (`nkst_api`) using JSON:API 1.1 envelopes.

## Environment Setup

1. Copy `.env.example` to `.env.local` (already configured for local development):
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

### Default Development Platform Admin
- **Email:** `admin@nkst.org.ng`
- **Password:** `ChangeMe@123!`

## Modules Implemented

- **Authentication & Sessions** (`/login`): Email/phone login, JWT access & automatic refresh token rotation, password recovery via OTP, active device sessions modal, sign out / sign out all devices, and strict role-based Admin Auth Guard (`PLATFORM_ADMIN`, `CHURCH_ADMIN`, `GROUP_ADMIN`).
- **Dashboard** (`/`): Scoped KPIs from `/audit/counts`, verification pipeline breakdown, geographic & congregation counts, and recent moderation actions.
- **Verification Queue** (`/verification`): 4-pathway membership verification review (Catechism, 10 Peer Acknowledgements, Church Validation, Platform Validation) with Approve/Reject (mandatory reason) and Direct Validate.
- **Moderation Center**:
  - **Posts Queue** (`/moderation/posts`): Approve, reject, request corrections, and inspect post moderation history.
  - **Content Reports** (`/moderation/reports`): Dismiss, hide, or remove reported posts, comments, and gallery photos (highlighting minor removal requests).
  - **Gallery & Minors Safeguarding** (`/moderation/gallery`): Photo review queue with prominent minors safeguarding & consent flags, album assignment, and church album management.
  - **Resources & Central Library** (`/moderation/resources`): Approve/reject submitted resources (with category adjustment) and search/filter the Central Library.
- **Churches & Congregations** (`/churches`): Directory with Nigerian State/LGA filters, geo-location pin view, create/edit church records (enforcing CHR-09), sole Church Admin assignment, and church deactivation.
- **Members & RBAC** (`/members`): Member UUID inspector with authorized governance unmasking, suspend/reinstate with mandatory reason, role assignment/revocation, and seeded Roles & Permissions matrix.
- **Groups Administration** (`/groups`): Create church/national groups with eligibility rules, approve/reject join requests, invite eligible members, promote Group Admins, and remove members.
- **Marketplace Governance (Non-Financial)** (`/marketplace`): Hard-copy fulfilment pool monitoring with waiting times, order closing/cancellation, active listings moderation, and seller access period grants/revocations.
- **Communications** (`/communications`): Official announcements publisher (skips moderation) and national NKST recitations drafter/publisher.
- **Audit Logs** (`/audit`): System audit trail (`PLATFORM_ADMIN`) and cross-module moderation history.
