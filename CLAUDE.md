# HISA Matcha CRM — Claude System Guide

This document defines the operational rules Claude Code must follow when modifying this repository.

Claude must read this file before making changes.

The goal is to keep the system:

• predictable
• safe for production
• easy to evolve

This CRM is an internal operations tool, not a public SaaS.

---

# High-Level Architecture

Frontend
Next.js (App Router)
TypeScript
Tailwind

Backend
Next.js API routes

Database
Supabase (Postgres)

External integrations
Google Sheets API (Service Account) — used for lead imports only

Future integrations
Stripe
FedEx API

---

# Architectural Principles

The CRM is intentionally simple and centralized.

Avoid:

• microservices
• complex event systems
• unnecessary abstractions

Prefer:

• direct database queries
• simple API routes
• clear data models

---

# Source of Truth

Products → Supabase (editable in CRM)
Leads → Google Sheets (imported into CRM)
Customers → Supabase
Sales pipeline → Supabase
CRM Settings → Supabase (crm_settings table)

Flow:

Research → Google Sheets
Import → CRM
Manage → CRM

Google Sheets is the research layer for leads, not the CRM.

Products are fully managed inside the CRM. Google Sheets is no longer used for product management.

---

# Environment Variables

Stored in `.env.local`

Supabase

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

Google Sheets

GOOGLE_SERVICE_ACCOUNT_KEY

Product Master (legacy — no longer used for products)

GOOGLE_SHEET_ID
GOOGLE_SHEET_TAB

Lead Lists

LEADS_GOOGLE_SHEET_ID
LEADS_SHEET_TABS

Example

LEADS_SHEET_TABS=United States,Europe,Asia

Claude must never hardcode sheet names.

---

# Core Database Tables

Primary table:

customers

This table stores:

• leads
• prospects
• active customers

The column `status` differentiates them.

Example values:

lead
customer
inactive

Other key tables:

products — product catalog with multi-currency pricing
pricing_tiers — volume discount tiers per product
crm_settings — key-value config (exchange rates, shipping, thresholds)
opportunities — sales pipeline
opportunity_proposals + opportunity_proposal_items — price proposals
call_logs — structured call records
sample_batches + sample_batch_items — sample tracking

---

# Lead System

Leads are imported from Google Sheets.

Endpoint:

/api/leads/sheets-import

Leads are stored inside the customers table.

Lead columns:

lead_stage
instagram_url
website_url
serves_matcha
platform_used
date_generated
date_contacted
source_region
last_imported_at
lead_assigned_to
notes

---

# Lead Pipeline

Lead stages:

new_lead
contacted
replied
qualified
handed_off
disqualified

Default:

new_lead

Future UI:

Kanban pipeline board.

---

# Lead Side Panel (Split-View)

The /leads page uses a split-view layout.

Clicking a lead row opens a 400px side panel on the right instead of navigating to /leads/[id].

The table narrows to accommodate the panel.

Panel sections:

1. Header: cafe name, city, source badge, stage badge, Instagram link, website link
2. Outreach stats: message count, first contacted, last messaged
3. Message composer (reuses MessageComposer component)
4. Message history (reuses OutreachTimeline component)
5. Quick actions: Convert to Opportunity (when stage is replied or qualified)
6. Footer: "Open Full Detail →" link to /leads/[id]

Behavior:

• Clicking a different row swaps panel content instantly
• Clicking the same row or X closes the panel
• Escape closes the panel
• ArrowUp/ArrowDown navigates between leads while panel is open
• Sending a message updates the table row immediately (local state, no page reload)

The /leads/[id] detail page remains unchanged.

It is used for enrichment, full notes editing, and the Convert to Opportunity flow.

Key files:

app/(dashboard)/leads/LeadSidePanel.tsx
app/(dashboard)/leads/LeadsTable.tsx

API routes used by the panel:

GET /api/leads/[id]/messages
POST /api/leads/[id]/messages
PATCH /api/leads/[id]/messages/[logId]
POST /api/leads/[id]/convert

---

# Import Deduplication Rules

Lead import must prevent duplicates.

Priority order:

1. instagram_url
2. website_url
3. cafe_name + city

If a match exists:

Update existing record
Do NOT create a duplicate.

---

# Google Sheets Structure

Lead sheet columns include:

Contact Person
Platform Used
Date Generated
Cafe Name
Location
Serves Matcha?
Instagram URL
Website URL
Date Contacted

Never rely on column order.

Always use a COLUMN_MAP.

---

# Products System

Products are fully managed inside the CRM. Google Sheets is no longer used for products.

Products page:

/products

Table columns:

Product (customer_facing_product_name + product_id)
Internal JPN (name_internal_jpn)
Supplier
Type (product_type badge)
Cost ¥/kg (matcha_cost_per_kg_jpy)
Price $/kg (selling_price_usd)
Min $ (min_price_usd)
Margin (gross_profit_margin — color-coded badge)
Stock/mo (monthly_available_stock_kg)
Status (active/inactive)

Margin health badges:

Green: margin > 25% AND gross profit > $330/kg
Yellow: margin 15-25% OR gross profit $150-330/kg
Red: margin < 15% OR gross profit < $150/kg

Thresholds are read from crm_settings table (margin_alerts category).

Products are editable via a modal (admin only).

Row click → opens ProductEditModal with all fields.
"Add Product" button → opens same modal in create mode.

Multi-currency pricing:

USD: selling_price_usd, min_price_usd
GBP: selling_price_gbp, min_price_gbp
EUR: selling_price_eur, min_price_eur

Landing costs per market:

us_landing_cost_per_kg_usd
uk_landing_cost_per_kg_gbp
eu_landing_cost_per_kg_eur

Backward compatibility columns (kept in sync):

landing_cost_per_kg_usd = us_landing_cost_per_kg_usd
default_selling_price_usd = selling_price_usd
min_selling_price_usd = min_price_usd
price_per_kg = selling_price_usd

Key files:

app/(dashboard)/products/page.tsx
app/(dashboard)/products/ProductsTable.tsx
app/(dashboard)/products/ProductEditModal.tsx

API routes:

POST /api/products — create product (admin)
PATCH /api/products/[id] — update product (admin)
GET /api/products/[id]/tiers — get pricing tiers
PUT /api/products/[id]/tiers — replace pricing tiers (admin)
POST /api/products/import-master — CSV import (admin)

---

# Pricing Tiers

Volume pricing is stored in the pricing_tiers table.

Columns:

tier_id (uuid PK)
product_id (FK → products)
currency (USD, GBP, EUR)
tier_name (Standard, Gold, Platinum)
min_volume_kg
discount_pct
price_per_kg

Tiers are edited inside the ProductEditModal.

PUT endpoint replaces all tiers for a product (delete + insert).

---

# CRM Settings

Settings are stored in the crm_settings table.

Settings page:

/settings (admin only)

Categories:

exchange_rates — USD/JPY, USD/GBP, USD/EUR
shipping — JP→US, JP→EU shipping costs per kg
margin_alerts — red/yellow thresholds for profit and margin
company — name, phone, email, warehouse addresses

Each setting saves on blur via PATCH /api/settings.

API routes:

GET /api/settings — all settings (any role)
PATCH /api/settings — update single setting (admin)

Key files:

app/(dashboard)/settings/page.tsx
app/(dashboard)/settings/SettingsForm.tsx
app/api/settings/route.ts

---

# Migration Rules

All schema changes must use migrations.

Location:

/supabase/migrations

Naming pattern:

001_init.sql
002_products.sql
003_customers.sql
004_leads_v1.sql
...
011_products_pricing_overhaul.sql

Rules:

Never modify old migrations.

Always create a new migration.

Use safe SQL patterns:

ADD COLUMN IF NOT EXISTS
CREATE INDEX IF NOT EXISTS

Never drop tables in migrations.

---

# Database Safety

Claude must never:

• drop tables
• remove columns
• overwrite historical data

Always use additive schema evolution.

---

# Performance Guidelines

Prefer:

• server components
• batched queries
• indexed lookups

Indexes should exist for:

lead_stage
instagram_url
website_url
source_region
lead_assigned_to

Avoid unnecessary API calls.

---

# Security Rules

Never expose these to the client:

SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SERVICE_ACCOUNT_KEY

They must remain server-side.

Never print secrets in logs.

---

# UI Design Philosophy

This is an internal tool.

Priorities:

1. speed
2. clarity
3. operational efficiency

Avoid:

• complex UI frameworks
• heavy animations
• excessive modal flows

Prefer:

• tables
• direct editing
• keyboard efficiency

---

# Change Safety Rules

Before modifying code Claude must:

1. Read the affected files
2. Explain the proposed change
3. Modify the smallest number of files possible
4. Ensure the project builds

Claude must not perform large refactors without explicit request.

---

# Code Style

Prefer:

• readable code
• small functions
• clear naming

Avoid:

• clever abstractions
• meta-programming
• unnecessary libraries

---

# AI Guardrails

Claude must not:

• invent environment variables
• invent database columns
• invent API routes
• assume schemas

Claude must verify existing code first.

---

# Future System Extensions

Planned features:

Lead pipeline board
Opportunity tracking
Customer order history
Automated prospect discovery
Sales analytics

Claude should design code to remain compatible with these features.

---

# Final Principle

The CRM should always remain:

• understandable by a single developer
• deployable quickly
• resilient to schema changes

Simplicity is preferred over cleverness.

---

# Screenshots

Claude can take screenshots of the running CRM to visually verify UI changes.

Requires: `pnpm dev` running on localhost:3000

Script: `scripts/screenshot.mjs`

Usage:

```
node scripts/screenshot.mjs [path] [--width=1440] [--height=900] [--out=screenshot.png] [--full]
```

Examples:

```
node scripts/screenshot.mjs                                          # homepage
node scripts/screenshot.mjs /leads                                   # leads page
node scripts/screenshot.mjs /opportunities --full                    # full-page scroll capture
node scripts/screenshot.mjs / --width=375 --height=812 --out=mobile.png  # mobile viewport
```

After taking a screenshot, use the Read tool on the output file to view it.

Workflow:

1. Run the screenshot command via Bash
2. Read the screenshot file with the Read tool (it supports images)
3. Analyze the visual output and report issues

Claude should proactively take screenshots after UI changes to verify the result.

---

# End of File
