# host-html-mcp

MCP server for [host-html.com](https://host-html.com). Gives any MCP client — Claude Desktop,
Claude Code, Cursor, Codex — two tools: **publish a self-contained HTML document and get back a
public URL**, and **update it later at the same URL**.

AI assistants generate single-file HTML constantly: reports, dashboards, decks, prototypes.
Without somewhere to put it, the artifact dies in the chat window. This makes "share this as a
link" a single tool call.

## Install

```jsonc
// claude_desktop_config.json / .cursor/mcp.json / .mcp.json
{
  "mcpServers": {
    "host-html": {
      "command": "npx",
      "args": ["-y", "host-html-mcp"],
      "env": { "HOSTHTML_API_KEY": "hh_your_key_here" }
    }
  }
}
```

Get a key at **host-html.com → Account → API keys**. Publishing requires a free, email-verified
account. The key is tied to your account and counts against your plan.

## The tools

### `publish_html`

| Argument | Required | Notes |
|---|---|---|
| `html` | yes | Full self-contained document. Max 1MB on Free, 10MB on Pro, 50MB on Studio/Agency. Inline CSS/JS or use absolute URLs. |
| `title` | no | Sets the link-preview title. Pass a real one — a filename unfurls badly. |
| `slug` | no | Custom path, `2–64` lowercase letters/digits/internal hyphens. **Paid plans only**; omit for a random slug. |
| `password` | no | 4–72 characters; viewers must enter it. **Paid plans only.** |

Returns the public URL and, on the free plan, the date the page goes offline.

```
Published: https://host-html-user.com/p/q3-report
This free page goes offline on 2026-11-06 (UTC). …
```

### `update_page`

| Argument | Required | Notes |
|---|---|---|
| `slug` | yes | The page's slug, or its full URL. |
| `html` | yes | The replacement document. |

Replaces the page's HTML **at the same URL** — the link you already sent keeps working. Use it
for every revision instead of publishing a new page. Paid plans keep the previous version.

## Things worth knowing

- **Free pages go offline after a few days** (the tool tells you the exact date). Pages on a paid
  plan (Pro is $9/month) never expire. Free pages can be updated while they are still online.
- **Hosted pages run in a sandboxed iframe.** `<a download>` is blocked and query strings are
  stripped, so deep-linking via `?param=` will not work.
- **The edit token is deliberately not returned to the model.** It is a bearer credential, and
  tool output ends up in transcripts, issues and logs. `update_page` authenticates with your API
  key instead.
- **Only the HTML is hosted.** Relative `<link>`/`<script>` paths will 404 — inline them or use
  absolute URLs.

## Related

- REST API: <https://host-html.com/api>
- Claude Code plugin and skills: <https://github.com/phanosh/host-html>

## Development

Pure logic lives in `lib.mjs` and is unit tested from the main repo
(`src/test/mcp-server.test.ts`). `index.mjs` is MCP wiring only.

```sh
npm install
npx vitest run src/test/mcp-server.test.ts   # from the repo root
```

MIT.
