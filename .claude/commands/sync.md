# /sync — Push project state to Obsidian

Sync the current Hisa HQ project state to the Obsidian vault at `/Users/takuma_endo/Desktop/Second Brain/Projects/Dev Projects/Hisa HQ App/`.

## Steps

1. **Read current state:**
   - Run `git log --oneline -10` to see recent commits
   - Run `git diff --stat HEAD~5..HEAD` to see what files changed recently
   - Check for any new or modified specs, decisions, or architecture changes in the codebase

2. **Update Status.md:**
   - Read the current `Status.md` in the Obsidian vault
   - Update it based on what was built, what's in progress, and any blockers
   - Move completed items from "In Progress" to "Done" with today's date
   - Add any new in-progress work
   - Update the `updated` frontmatter date to today

3. **Log architecture decisions:**
   - If any significant architecture decisions were made in recent commits (new dependencies, schema changes, major refactors), create a new decision file in `Decisions/` using the format `YYYY-MM-DD [Decision Title].md`
   - Skip this step if no meaningful decisions were made

4. **Update specs if needed:**
   - If a spec's feature was built or modified, update the spec's `status` frontmatter (draft → ready → building → done)
   - If what was built differs from the spec, update the spec to reflect what was actually built

5. **Confirm what was synced:**
   - List what files were updated in Obsidian
   - Keep the summary short — just the file names and what changed
