# host-html

[![host-html.com](screenshot.png)](https://host-html.com)

> **Publish any HTML file as a live link — instantly.**
> No login. No config. No deploy pipeline.
> → **[host-html.com](https://host-html.com)**

---

## Install

### Claude Code
```
/plugin marketplace add phanosh/host-html
/plugin install host-html@host-html
```

> The official Claude Code marketplace listing is in the works — until it lands, install directly from this repo with the two commands above.

### Other AI Agents (Skills)
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

## Update

When a new version is released here, pull it into your local Claude Code with:

```
/plugin marketplace update phanosh/host-html
```

That single command refreshes the marketplace catalog and installs any version bumps in `marketplace.json`, `plugin.json`, or the skill frontmatter. To check what you're on:

```
/plugin
```

To stay current automatically, open `/plugin`, go to the **Marketplaces** tab, select `phanosh/host-html`, and toggle **auto-update** on — Claude Code will then pull updates on startup.

For the standalone skills install (`npx skills add ...`), re-run the same command to upgrade:

```bash
npx skills add phanosh/host-html -g -y
```

---

## Direct API

The publish edge function expects the public Supabase anon JWT in the `Authorization` and `apikey` headers (this key is safe to share — it's designed for client-side use):

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aWZnc3Z0Y2JyYXd6ZGh5dWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjM2MTQsImV4cCI6MjA5NDk5OTYxNH0.wWploAOhZ0BjCbOoMWe8g11Qx-ZE3_Kj20h0kM8My1M"

curl -X POST https://suifgsvtcbrawzdhyuhk.supabase.co/functions/v1/publish \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello</h1>", "title": "my page"}'
```

**Request**

| Field   | Type   | Required | Description                                  |
|---------|--------|----------|----------------------------------------------|
| `html`  | string | ✓        | HTML content (max 1MB)                       |
| `title` | string |          | Page title                                   |
| `slug`  | string |          | Custom URL path matching `^[a-z0-9-]{2,64}$` |

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

The response's `expires_at` is the authoritative expiry — read it from the response rather than assuming a fixed duration.

---

## License

MIT
