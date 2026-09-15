# AI App Finder

An internal decision-support tool for Zeitview that helps employees:

1. **Find the right AI tool** for a task — answer a few questions about what you need to do, your comfort level, budget, data sensitivity, and how often you'll use it, and get a ranked shortlist of approved AI tools with examples and setup steps.
2. **Check whether a specific app is already approved** — type in an app name and see whether it's cleared for the kind of data involved. If it isn't (or isn't in the catalog at all), the tool surfaces the closest approved alternative, or lets you request an IT/Security review directly.

## Policy baked into the tool

Confidential or customer data may only be processed with **Claude Enterprise**. Every other tool is routed to a "Request Security Approval" (or "Request IT review") mailto link instead of a direct recommendation for that classification.

## Running it

This is a single self-contained HTML file (`index.html`) — no build step, no server required. Open it directly in a browser, or serve it via GitHub Pages:

1. In the repo settings, enable **GitHub Pages** for this repository (Settings → Pages → Deploy from a branch → `main` / root).
2. The tool will be live at `https://<username>.github.io/<repo-name>/`.

## Notes for maintainers

- The tool catalog, scoring logic, and both wizards live entirely in the `<script>` block of `index.html`.
- `SECURITY_APPROVAL_EMAIL` (currently a placeholder `security@zeitview.com`) should be pointed at your real Security/IT intake — an email alias, ticket queue, or form link.
- Licensed under GPL-3.0 (see `LICENSE`).
