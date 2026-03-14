# IronTrack Copilot Review Instructions

When asked to review code or a PR, follow this process strictly:

1. Inspect all changed files before giving any feedback.
2. Do not provide a summary-only response without file-by-file review coverage.
3. Report findings first, ordered by severity: `P0`, `P1`, `P2`.
4. For each finding, include:
   - file path
   - line reference
   - risk/impact
   - concrete fix recommendation
5. Call out missing or weak tests for business-critical logic, edge cases, and regressions.
6. If no issues are found, explicitly state:
   - all changed files were reviewed
   - no material defects were found
   - any residual risk or test gaps

Review quality standards:

- Prefer correctness and behavioral risk over style-only comments.
- Flag security, data integrity, and production reliability issues early.
- Identify duplicated logic and recommend DRY refactors when behavior can drift.
- Keep feedback actionable and specific.
