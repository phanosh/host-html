# host-html

[![host-html.com](screenshot.png)](https://host-html.com)

> **Publish any HTML file as a live link — instantly.**
> No login. No config. No deploy pipeline.
> → **[host-html.com](https://host-html.com)**

---

## For AI Agents

Install once. Use everywhere.

```bash
npx skills add phanosh/host-html -g -y
```

Then use the skills:

```
/host-html          # publish HTML as a live link
/host-pdf           # export HTML slides to PDF
```

`/host-html` finds the HTML, publishes it, and hands you a live URL in seconds.
`/host-pdf` captures each slide at retina quality and assembles a PDF.

Works with **Claude Code**, Cursor, Codex, Copilot, and [40+ more agents](https://host-html.com).

---

## Direct API

```bash
curl -X POST https://qtmscjnlixeyqalhzvde.supabase.co/functions/v1/publish \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello</h1>", "title": "my page"}'
```

**Request**

| Field   | Type   | Required | Description                         |
|---------|--------|----------|-------------------------------------|
| `html`  | string | ✓        | HTML content (max 1MB)              |
| `title` | string |          | Page title                          |
| `slug`  | string |          | Custom URL path (a-z, 0-9, hyphens) |

**Response `201`**

```json
{
  "url": "https://host-html.com/p/abc123",
  "slug": "abc123",
  "edit_token": "...",
  "page_id": "...",
  "expires_at": "2026-03-16T..."
}
```

Pages live for **7 days** on the free tier.

---

## License

MIT
