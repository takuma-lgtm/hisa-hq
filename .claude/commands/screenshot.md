# /screenshot — Capture and review a page

Take a screenshot of a page using the project's screenshot script, then review the UI.

## Usage

`/screenshot [page-path]` — e.g., `/screenshot /leads`, `/screenshot /inventory`

If no page path is provided, ask which page to screenshot.

## Steps

1. **Ensure dev server is running:**
   - Check if `localhost:3000` is reachable
   - If not, start `pnpm dev` in the background and wait for it to be ready

2. **Take screenshot:**
   - Run `node scripts/screenshot.mjs [page-path]`
   - Use default width/height unless the user specifies otherwise
   - Available flags: `--width`, `--height`, `--out [filename]`, `--full` (full page)

3. **Review the screenshot:**
   - Display the screenshot image
   - Check for: layout issues, overlapping elements, missing data, broken styles
   - Note anything that looks off

4. **Report:**
   - Show the screenshot
   - List any UI issues spotted, or confirm the page looks good
