# host-html

Publish any HTML file as a live hosted link — one command, zero config.

## For AI Agents (Claude Code, Cursor, etc.)

### Install the skill

```bash
npx skills add phanosh/host-html --skill hosthtml-publish -g -y
```

### Use it

```
/host-html
```

Your agent will find the HTML, publish it, and give you a live URL.

## Direct API Usage

```bash
curl -X POST https://qtmscjnlixeyqalhzvde.supabase.co/functions/v1/publish \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello World</h1>", "title": "my-page"}'
```

### Request

| Field   | Type   | Required | Description                         |
|---------|--------|----------|-------------------------------------|
| `html`  | string | yes      | HTML content (max 1MB)              |
| `title` | string | no       | Page title                          |
| `slug`  | string | no       | Custom URL path (a-z, 0-9, hyphens) |

### Response (201)

```json
{
  "url": "https://host-html.co/p/abc123",
  "slug": "abc123",
  "edit_token": "64-char hex string",
  "page_id": "uuid",
  "expires_at": "2026-03-13T00:00:00.000Z"
}
```

Pages expire after 7 days on the free tier.

## License

MIT
