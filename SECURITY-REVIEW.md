# Security review

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | `src/components/RichTextView.tsx` | 28 | Untrusted Bluesky facet URLs are rendered without an `http:`/`https:` scheme allowlist, allowing a malicious `javascript:` URL to execute when clicked. | 8/10 |
| 2 | 🟠 HIGH | `src/components/ExternalLinkCard.tsx` | 10 | Untrusted external embed URLs are rendered without an `http:`/`https:` scheme allowlist, allowing a malicious `javascript:` URL to execute when clicked. | 8/10 |

## Impact

Malicious Bluesky content could execute script in the application origin when a user clicks a crafted link, potentially exposing client-side session data stored in `localStorage`.

## Recommended remediation

Validate every URL before rendering it as an anchor target. Parse the value with `new URL()` and allow only `https:` (and `http:` if explicitly required); reject unsupported schemes for rich-text facets and external embed cards.
