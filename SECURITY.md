# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active  |
| < 0.1   | ❌        |

## Reporting a Vulnerability

If you discover a security issue in kinetik, **please don't open a public issue.**

Email security concerns to: **security@kinetik.dev** (placeholder — set up real
contact before publishing to npm).

We aim to:
- Acknowledge the report within 48 hours
- Provide a timeline for a fix within 7 days for critical issues
- Credit reporters in the CHANGELOG (with permission)

## Scope

The core engine runs entirely in the browser. There is no server component, so
the attack surface is limited to:
- XSS via the `attributes` / `listeners` we spread onto user-controlled elements
  (we don't escape these — they're typed as opaque records — so the responsibility
  is on the consumer)
- DOM-based attacks via malicious HTML passed to `<DragOverlay>` (consumer's
  responsibility — escape user input)

## Past Advisories

None. This is the first release.
