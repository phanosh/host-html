---
name: host-html
description: Publish HTML files as live hosted links via host-html.com
version: 2.0.0
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

Make a POST request to the host-html publish API. Publishing now requires an
authenticated, email-verified host-html account — pass a personal API key
(format `hh_` + 40 characters) as the bearer token. Read it from the
`HOSTHTML_API_KEY` environment variable; if it isn't set, stop and tell the
user to create one (see "Setup" in the README) before retrying:

> Publishing now requires a free host-html account. Sign up at
> https://host-html.com, confirm your email, then go to Account → API keys →
> Create key, and set `HOSTHTML_API_KEY` to the `hh_…` value
> (e.g. `export HOSTHTML_API_KEY=hh_...`).

Do not attempt the request without a key. Send **only** the
`Authorization: Bearer` header — there is no longer an `apikey` header.

```bash
if [ -z "$HOSTHTML_API_KEY" ]; then
  echo "Set HOSTHTML_API_KEY to a personal API key from host-html.com → Account → API keys."
  exit 1
fi

curl -s -X POST "https://suifgsvtcbrawzdhyuhk.supabase.co/functions/v1/publish" \
  -H "Authorization: Bearer $HOSTHTML_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"html\": \"<FULL_HTML_CONTENT>\", \"title\": \"<OPTIONAL_TITLE>\"}"
```

**Request body:**
- `html` (required): The full HTML content as a string. Escape any quotes/special chars for JSON.
- `title` (optional): A human-readable title for the page.
- `slug` (optional): A custom URL path matching `^[a-z0-9-]{2,64}$` (lowercase alphanumerics and hyphens). **Custom slugs still require the account to be Pro/Team.** Publishing with a personal API key from a free account works, but sending a `slug` returns a `401` telling the user to upgrade. If the authenticated account is on the free plan, drop `slug` and let the API assign a random one, or point the user at host-html.com pricing to upgrade.

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

`expires_at` is `string | null` — an ISO timestamp on a free plan, and `null` on a paid plan,
where the page never expires. Check for null before formatting it.

## Step 4: Present the result

Show the user:
1. **Live URL**: The `url` from the response — this is the public link to their page, use it verbatim
2. **Expiry**: Read `expires_at`. If it is a timestamp, present it human-readably; if it is `null`, the plan includes permanent hosting — say the page doesn't expire rather than printing a date. Don't hardcode a duration like "7 days" — the API decides when the page expires and that may change.
3. **Edit token**: Save `edit_token` — keep it with the page record. The API currently exposes publishing only (`POST`); there is no update/edit endpoint yet, so the token can't modify a live page today. Saving it now means the page is editable as soon as an update flow ships — don't tell the user they can edit it right now.

Format the output clearly:

```
Published!

URL: https://host-html.com/p/abc123
Expires: March 13, 2026   (from expires_at; or "Never expires" when it is null)
Edit token: (saved for future edits)
```

## Error Handling

Auth errors return a JSON body shaped `{ "error": "<code>", "message": "<string>" }`.
Always surface the server's `message` field to the user verbatim (the copy is
server-owned and may change — don't paraphrase it), then add the guidance below.

- **401 `auth_required`**: No `Authorization` header, or an unrecognized/garbled bearer token. Show the server `message`, then tell the user to generate a personal API key at host-html.com → Account → API keys and set it as `HOSTHTML_API_KEY` (`export HOSTHTML_API_KEY=hh_...`).
- **401 `invalid_api_key`**: The token looks like an `hh_…` key but is unknown or revoked. Show the server `message`, then tell the user to check `HOSTHTML_API_KEY` or generate a new key — the old one may have been revoked.
- **401 `project_anon_key_not_allowed`**: The token is the shared project anon/service-role key (the skill's old hardcoded credential). Show the server `message`; this means the skill or environment is still on the old key. Tell the user to set `HOSTHTML_API_KEY` to a personal `hh_…` key.
- **403 `email_not_verified`**: Valid auth, but the account's email isn't confirmed. Show the server `message`, then tell the user to check their inbox, confirm their email, and retry.
- **403 `account_suspended`**: The account has been suspended. Show the server `message` and do not retry automatically.
- **503 `verification_check_failed`**: Transient server-side error while checking verification status. Show the server `message`; this is not a config problem — it's safe to retry once after a short pause.
- If the API returns 401 with a "Sign in to pick a custom link" (or upgrade) message: A custom `slug` was sent but the authenticated account is on the free plan. Drop the `slug` and re-publish — the API will assign a random one — or point the user at host-html.com pricing.
- If the API returns 400: Check that `html` is non-empty and under 1MB, and that any `slug` matches `^[a-z0-9-]{2,64}$`
- If the API returns 409: The custom slug is taken — retry without a slug or suggest a different one
- If the API returns 500: Report the error and suggest trying again

## Tips

- For the `title`, derive it from the HTML `<title>` tag if present, or the filename
- If the HTML references external CSS/JS via relative paths, warn the user that only the HTML file is hosted — external assets need absolute URLs
- The edit token is worth saving for future edits, but the API has no update endpoint yet — don't promise the user they can change the page after publishing
