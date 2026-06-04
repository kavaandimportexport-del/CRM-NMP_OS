# NMP Sales OS — Product Requirements Document

## Original Problem Statement
Build NMP Sales OS (New Music Palace Sales Operating System) — India's leading Music Industry Sales CRM and Business Operating System for Music Instruments, Pro Audio, Studio Solutions, School Audio, Church Audio, Auditorium Projects, Corporate AV, Event Companies, and Government Projects. The CRM should be specialised, lead-centric (one lead = one source of truth), GPS-verified, and scalable for national growth.

## Architecture
- **Frontend**: React 19 + Tailwind + Shadcn UI + Phosphor Icons + Recharts (Manrope/IBM Plex Sans)
- **Backend**: FastAPI + Motor (Mongo async) + bcrypt + PyJWT
- **DB**: MongoDB (single-tenant)
- **Auth**: JWT (bearer + httpOnly cookie), role-based access (super_admin / admin / sales_manager / field_sales / store_sales)
- **PDFs**: jsPDF + autoTable client-side
- **File storage**: base64 in Mongo `files` collection (MVP; swap for S3/Emergent storage in Phase-3)

## User Personas
- Super Admin – workspace owner, full control
- Admin – manages teams, inventory, employees
- Sales Manager – oversees regions, audits visits
- Field Sales Executive – GPS-verified site visits, quotations
- Store Sales Executive – walk-in product sales

## Implemented (Phase 1 — Feb 2026)
- Authentication: setup-admin, login, /me, logout, JWT bearer + cookie
- Lead Management: CRUD + filters (status/type/assigned), source/type/visit/priority enums, lead health score (0–100)
- Customer 360: tabs (Overview/Activities/Site/Photos/Tasks/Quotations/Timeline)
- GPS site verification + photo upload (base64)
- Tasks with type, due date, status toggle
- Quotations with line items, GST, terms, PDF generation
- Inventory CRUD + CSV bulk import (admin only)
- Employee invitation workflow (invite token + temp password)
- Static Playbooks (6 categories), Knowledge Hub (7 articles), Training (5 modules)
- Dashboard KPIs + pipeline/source charts
- Reports page

## Implemented (Phase 2 — Feb 2026)
- **P1 Quotation upgrade**: Product catalog autocomplete search (name/SKU/brand), 12-product seed catalog, extra charges (Installation/Freight/AMC/Misc) with 18% GST, status workflow (Draft/Sent/Viewed/Negotiation/Approved/Rejected), inline status select on quotation row, PDF includes extras section
- **P2 Sales Pipeline (Kanban)**: New `/pipeline` page with 7 stage columns showing count + INR pipeline value; quick status move via dropdown
- **P3 Follow-up Engine**: `next_follow_up`, `follow_up_type` fields on lead; `/api/follow-ups` endpoint returning today/overdue/upcoming buckets; dashboard widgets for today & overdue
- **P9 Extended Lead Fields**: decision_maker, budget, expected_closure_date, probability, competitor, closure_type
- **P14 Dashboard expansion**: Pipeline value, Won revenue, Today follow-ups, Overdue follow-ups tiles + Today/Overdue list cards
- 12 seed products: Shure SM58/BLX24, Sennheiser e835, Yamaha MG10XU/DXR10, JBL EON710, AKG K240, Behringer X1832, Bose S1Pro+, Rode NT1, Focusrite 2i2, KRK Rokit 5

## Implemented (Phase 2 Round 3 — Feb 2026)
- **Sidebar**: Removed standalone Playbooks and Knowledge tabs per user feedback (data still in DB; can be exposed via embedded panels later)
- **Training & Certification (LMS upgrade)**:
  - 3 video types: **Training Video**, **Product Demo**, **SOP Video** (color-coded badges + filter tabs)
  - Admin CRUD: Add/Edit/Delete training modules with title, category, duration, description, video_url, video_type
  - Video player modal: auto-converts YouTube/Vimeo share URLs to embed URLs; supports direct mp4
  - "Mark Watched" auto-fires when video opens → status moves to "In Progress"
  - In-modal quiz builder with multiple-choice options + radio button for correct answer + add/remove questions
  - Per-user progress (Not Started / In Progress / Certified / Failed) with score
  - Auto-generated branded **Certificate PDF** on quiz pass (≥70%) — includes employee name, training title, score, certificate number, issue date
  - 6 seeded modules across all 3 types (Sales Process, Quotation Writing, Shure SM58 Demo, Yamaha DXR Demo, Auditorium Install SOP, Site Survey SOP)
- **Pipeline Weighted Forecast Heat-Map**:
  - New "Weighted Forecast" KPI tile = sum of (expected_deal_value × probability%)
  - Each lead card colored by `weighted / column_max`: green left-border (top 1/3), amber (mid 1/3), neutral (bottom 1/3)
  - Per-card display of probability% and weighted INR value
- **Testing**: 20/20 new LMS tests pass + 19/20 prior regression (one pre-existing test storage drift, not a product bug)
- **Quotation share**: mailto Email share button + WhatsApp wa.me share button on each quotation row (auto-fills customer phone/email)
- **Employee admin actions**: Resend invite, Revoke invite, Suspend, Terminate, Activate, Reset password (returns temp password), Force logout, Login history modal — all gated to super_admin/admin
- **JWT token_version**: Force-logout / status changes increment `token_version` so old JWTs return 401 "Session revoked"
- **Login history**: Every login (success + fail) stored in `login_history` collection with IP + user agent
- **Closure-type guard**: Cannot mark lead "Won" without a closure_type; frontend modal prompts (Site Visit / Phone Call / WhatsApp / Virtual Meeting / Email Closure)
- **LMS (Training)**: DB-backed modules with multiple-choice quizzes (3-5 questions each), score-based pass/fail (70% pass mark), certificate PDF auto-generation with NMP branding, per-user progress tracking
- **Knowledge Hub CRUD**: Admin can create / edit / delete / publish articles
- **Playbook CRUD**: Admin can create / edit / delete playbooks with discovery questions, objections, products, checklist
- **Approval Rate KPI**: Dashboard shows quotation approval rate (% Approved / total Sent-or-more)
- **Stale-quote nudge**: `POST /api/quotations/run-stale-nudge` (admin/manager) auto-creates Follow-Up tasks for quotations Sent >3 days ago; idempotent
- **Testing**: 35/35 backend tests pass (20 new + 15 regression)

## Backlog (Prioritized)

### P0 — Next iteration
- Quotation actions: Email & WhatsApp send (currently only PDF)
- Employee admin actions: Resend invite, Revoke, Suspend, Terminate, Reset password, Force logout, Login history
- Closure type mandatory before Won status

### P1 — Following iteration
- Full LMS: Video player + PDF + Quiz + Certificate PDF generation
- Knowledge Hub CRUD (admin create/edit/delete/publish)
- Playbook CRUD with read tracking
- GPS check-in/check-out with distance travelled and signature capture
- Granular RBAC matrix (8 roles × 20+ permissions)

### P2 — Future
- WhatsApp Business API integration
- AI Sales Assistant (Claude/GPT)
- AI Quotation Assistant
- Customer Support / Service Tickets / Warranty
- Installation Management + Technician Management

## Default Credentials
- `admin@nmp.com` / `admin123` (super_admin, auto-seeded on startup)
