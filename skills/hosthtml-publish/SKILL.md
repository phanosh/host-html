---
name: hosthtml-publish
description: Publish HTML files as live hosted links via host-html.comm
version: 1.0.0
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

Make a POST request to the host-html publish API:

```bash
curl -s -X POST "https://qtmscjnlixeyqalhzvde.supabase.co/functions/v1/publish" \
  -H "Content-Type: application/json" \
  -d "{\"html\": \"<FULL_HTML_CONTENT>\", \"title\": \"<OPTIONAL_TITLE>\"}"
```

**Request body:**
- `html` (required): The full HTML content as a string. Escape any quotes/special chars for JSON.
- `title` (optional): A human-readable title for the page.
- `slug` (optional): A custom URL path (lowercase alphanumeric + hyphens, 2-64 chars).

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

## Step 4: Present the result

Show the user:
1. **Live URL**: The `url` from the response — this is the public link to their page
2. **Expiry**: The page expires in 7 days (mention the date from `expires_at`)
3. **Edit token**: Save `edit_token` — it's needed to update the page later

Format the output clearly:

```
Published!

URL: https://host-html.com/p/abc123
Expires: March 13, 2026
Edit token: (saved locally)
```

## Error Handling

- If the API returns 400: Check that `html` is non-empty and under 1MB
- If the API returns 409: The custom slug is taken — retry without a slug or suggest a different one
- If the API returns 500: Report the error and suggest trying again

## Tips

- For the `title`, derive it from the HTML `<title>` tag if present, or the filename
- If the HTML references external CSS/JS via relative paths, warn the user that only the HTML file is hosted — external assets need absolute URLs
- The edit token is important — suggest the user save it if they want to update the page later
