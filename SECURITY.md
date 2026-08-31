# Security Policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this
repository. Please do not open public issues for security problems.

Include steps to reproduce and the affected endpoint or component. We usually reply within a week.

## Scope

- Worker API (`worker/`): admin auth, rate limiting, uploads, submission endpoints
- Frontend (`src/`): XSS in `/admin`, which renders unreviewed submissions and edits
- CI/supply chain: workflow and dependency integrity

Out of scope: vulnerabilities requiring the maintainer's mailbox or the `ADMIN_BREAKGLASS`
recovery secret, and issues in third-party sites the map links to.
