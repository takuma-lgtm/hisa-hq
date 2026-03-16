# /migrate — Create a new Supabase migration

Create a new numbered migration file following the project's convention.

## Usage

`/migrate [description]` — e.g., `/migrate add_tracking_number_to_orders`

If no description is provided, ask what the migration should do.

## Steps

1. **Determine the next migration number:**
   - List files in `supabase/migrations/`
   - Find the highest number prefix (e.g., `021`) and increment by 1
   - Format: `NNN_description.sql` (e.g., `022_add_tracking_number_to_orders.sql`)

2. **Create the migration file:**
   - Create the file in `supabase/migrations/` with the correct name
   - Add a comment header: `-- Migration: [description]`
   - Add the SQL based on what the user described

3. **Remind about project rules:**
   - ⚠️ Additive changes only — never DROP tables or columns
   - ⚠️ Never modify existing migration files
   - ⚠️ Use `IF NOT EXISTS` for safety where appropriate

4. **Report:**
   - Show the file path and contents
   - Remind to run `pnpm build` after to check for type impacts
   - Remind to update `types/database.ts` if needed
