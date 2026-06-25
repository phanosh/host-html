---
name: host-html
description: Publish HTML files as live hosted links via host-html.com
version: 1.2.0
triggers:
  - /host-html
---

# host-html: Publish HTML as a Link

When the user runs `/host-html`, follow these steps:

## Step 1: Find HTML to publish

Look for HTML content to publish. Check in this order:
1. If the user specifies a file path (e.g., `/host-html index.html`), read that file
2. If there's a recently generated/modified `.html` file in the current project, use that
3. If you just generated HTML in the conversation, use that content
4. Ask the user which HTML file or content to publish

## Step 2: Read the HTML content

Read the full contents of the HTML file. The content must be:
- Valid HTML (full document or fragment)
- Under 1MB in size

## Step 3: Publish via API

Make a POST request to the host-html publish API. The endpoint requires the public Supabase anon JWT in both the `Authorization` and `apikey` headers — this key is designed to be embedded in client code and is safe to ship in this skill:

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aWZnc3Z0Y2JyYXd6ZGh5dWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjM2MTQsImV4cCI6MjA5NDk5OTYxNH0.wWploAOhZ0BjCbOoMWe8g11Qx-ZE3_Kj20h0kM8My1M"

curl -s -X POST "https://suifgsvtcbrawzdhyuhk.supabase.co/functions/v1/publish" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"html\": \"<FULL_HTML_CONTENT>\", \"title\": \"<OPTIONAL_TITLE>\"}"
```

**Request body:**
- `html` (required): The full HTML content as a string. Escape any quotes/special chars for JSON.
- `title` (optional): A human-readable title for the page.
- `slug` (optional): A custom URL path matching `^[a-z0-9-]{2,64}$` (lowercase alphanumerics and hyphens). **Custom slugs now require a signed-in account.** This skill publishes with the public anon key only — it has no user session — so sending a `slug` returns `401 "Sign in to pick a custom link — it's free"`. Anonymous publishing (no `slug`) always works and the API assigns a random slug. Only pass `slug` if the user has a way to authenticate the request; otherwise omit it and let the API generate one.

The API silently drops unknown fields — don't pass options that aren't listed above and expect them to take effect.

**Response** (201 Created):
```json
{
  "url": "https://host-html.com/p/abc123",
  "slug": "abc123",
  "edit_token": "...",
  "page_id": "...",
  "expires_at": "2026-03-13T..."
}
```

The `url` field is the canonical public link — use it as-is. Don't rewrite or substitute the host.

## Step 4: Present the result

Show the user:
1. **Live URL**: The `url` from the response — this is the public link to their page, use it verbatim
2. **Expiry**: Read the date from `expires_at` and present it human-readably. Don't hardcode a duration like "7 days" — the API decides when the page expires and that may change.
3. **Edit token**: Save `edit_token` — keep it with the page record. The API currently exposes publishing only (`POST`); there is no update/edit endpoint yet, so the token can't modify a live page today. Saving it now means the page is editable as soon as an update flow ships — don't tell the user they can edit it right now.

Format the output clearly:

```
Published!

URL: https://host-html.com/p/abc123
Expires: March 13, 2026   (from expires_at)
Edit token: (saved for future edits)
```

## Error Handling

- If the API returns 400: Check that `html` is non-empty and under 1MB, and that any `slug` matches `^[a-z0-9-]{2,64}$`
- If the API returns 401 with a "Sign in to pick a custom link" message: A custom `slug` was sent but the request isn't authenticated (this skill only has the anon key). Drop the `slug` and re-publish — the API will assign a random one.
- If the API returns 401 (`UNAUTHORIZED_NO_AUTH_HEADER` or `UNAUTHORIZED_INVALID_JWT_FORMAT`): The `Authorization: Bearer <ANON_KEY>` and `apikey: <ANON_KEY>` headers are missing or malformed — re-send the request with both headers set to the anon JWT above
- If the API returns 409: The custom slug is taken — retry without a slug or suggest a different one
- If the API returns 500: Report the error and suggest trying again

## Tips

- For the `title`, derive it from the HTML `<title>` tag if present, or the filename
- If the HTML references external CSS/JS via relative paths, warn the user that only the HTML file is hosted — external assets need absolute URLs
- The edit token is worth saving for future edits, but the API has no update endpoint yet — don't promise the user they can change the page after publishing
