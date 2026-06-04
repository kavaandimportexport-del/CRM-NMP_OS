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
