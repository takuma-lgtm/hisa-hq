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
Google Sheets API (Service Account)

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

Products → Google Sheets
Leads → Google Sheets
Customers → Supabase
Sales pipeline → Supabase

Flow:

Research → Google Sheets
Import → CRM
Manage → CRM

Google Sheets is the research layer, not the CRM.

---

# Environment Variables

Stored in `.env.local`

Supabase

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

Google Sheets

GOOGLE_SERVICE_ACCOUNT_KEY

Product Master

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

Products come from Google Sheets.

Sheet:

Product Master

Products page:

/products

Products display:

external_name
internal_name_eng
internal_name_jpn
supplier
landing_cost
margin
stock

Products are read-only inside the CRM.

Google Sheets remains the source of truth.

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
