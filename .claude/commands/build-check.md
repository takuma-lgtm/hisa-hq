# /build-check — Lint and build the project

Run lint and build to catch type errors, lint violations, and build failures.

## Steps

1. **Run lint:**
   - Execute `pnpm lint`
   - If there are errors, list each one with the file and line number

2. **Run build:**
   - Execute `pnpm build`
   - If the build fails, parse the error output and identify the root cause

3. **Report:**
   - ✅ If both pass: "Build and lint clean — safe to commit"
   - ❌ If either fails: list each error with a suggested fix
   - Group errors by file for easy navigation
