// Pure logic for the host-html MCP server.
//
// Kept separate from the MCP wiring (index.mjs) so every decision here is unit
// tested from the main repo's vitest run — the same split the edge functions use
// (_shared/logic.ts tested by src/test/edge-logic.test.ts).
//
// Spec: docs/superpowers/specs/2026-08-14-path-to-100k-arr-design.md §D.

export const PUBLISH_URL = "https://suifgsvtcbrawzdhyuhk.supabase.co/functions/v1/publish";

/** Same-URL revisions (`action: "save"`), accepted with an `hh_` key since #350. */
export const UPDATE_URL = "https://suifgsvtcbrawzdhyuhk.supabase.co/functions/v1/update-page-html";

/**
 * Where tool output sends a user who wants a page kept. Tagged so signups that
 * arrive from an agent transcript are attributable: an explicit utm_source wins
 * in src/lib/attribution.ts and lands in profiles.acquisition_source.
 */
export const PRICING_URL =
  "https://host-html.com/pricing?utm_source=host-html-mcp&utm_medium=agent";

/**
 * The largest plan's cap (Studio/Agency, 50MB). The server enforces the
 * caller's own plan cap (free 1MB, Pro 10MB) and says so; checking the
 * smallest cap here would wrongly refuse a paid user's 3MB report.
 */
export const MAX_HTML_BYTES = 50 * 1_048_576;

/** Mirrors PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH in supabase/functions/_shared/password.ts. */
export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 72;

// Mirrors CUSTOM_SLUG_RE in supabase/functions/_shared/logic.ts: lowercase
// alphanumerics with internal hyphens, 2–64 chars, no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidSlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.length < 2 || slug.length > 64) return false;
  return SLUG_RE.test(slug);
}

/**
 * Validate + assemble the POST body. Throws with an agent-readable message
 * rather than letting the API reject it — an MCP tool error is shown to the
 * model, so it should say what to fix.
 */
function checkHtml(html) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("`html` is required and cannot be empty.");
  }
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `html is ${(bytes / 1_048_576).toFixed(2)}MB — no plan accepts more than 50MB. ` +
        "Inline fewer assets, or link them from a CDN."
    );
  }
}

export function buildPublishBody({ html, title, slug, password } = {}) {
  checkHtml(html);
  const body = { html };
  const t = typeof title === "string" ? title.trim() : "";
  if (t) body.title = t;
  const s = typeof slug === "string" ? slug.trim() : "";
  if (s) {
    if (!isValidSlug(s)) {
      throw new Error(
        `Invalid slug "${s}". Use 2–64 lowercase letters, digits and internal hyphens ` +
          "(no spaces, underscores, or leading/trailing hyphens)."
      );
    }
    body.slug = s;
  }
  // Sent untrimmed: a password is the caller's exact string. Length is checked
  // here so the model gets the rule before a round trip; the plan gate (paid
  // only) stays server-side.
  if (typeof password === "string" && password !== "") {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      throw new Error(
        `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
      );
    }
    body.password = password;
  }
  return body;
}

/** Body for update-page-html's in-place save: same URL, new HTML. */
export function buildUpdateBody({ slug, html } = {}) {
  const s = typeof slug === "string" ? slug.trim() : "";
  // Accept a pasted URL as well as a bare slug — models often hand back the link.
  const fromUrl = s.match(/\/p\/([a-z0-9-]+)\/?$/);
  const bare = fromUrl ? fromUrl[1] : s;
  if (!bare || !/^[a-z0-9-]{1,64}$/.test(bare)) {
    throw new Error(
      "`slug` is required: the page's slug (the part after /p/) or its full URL."
    );
  }
  checkHtml(html);
  return { action: "save", slug: bare, html };
}

/**
 * Read the personal API key from the environment. Rejects the single most
 * common misconfiguration — pasting the Supabase anon JWT, which the API
 * refuses with `project_anon_key_not_allowed` — before spending a request.
 */
export function resolveApiKey(env = {}) {
  const key = (env.HOSTHTML_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "HOSTHTML_API_KEY is not set. Create a personal key at host-html.com → Account → " +
        "API keys, then set HOSTHTML_API_KEY=hh_… in your MCP server config."
    );
  }
  if (!key.startsWith("hh_")) {
    throw new Error(
      "HOSTHTML_API_KEY does not look like a personal API key (it should start with `hh_`). " +
        "A Supabase anon/project key will not work — generate one at host-html.com → Account → API keys."
    );
  }
  return key;
}

/**
 * Turn a non-2xx publish response into one actionable sentence. The server's
 * own `message` is surfaced verbatim where present (that copy is server-owned
 * and may change), with our guidance appended.
 */
export function mapPublishError(status, body) {
  const b = body && typeof body === "object" ? body : {};
  const code = typeof b.error === "string" ? b.error : "";
  const serverMsg = typeof b.message === "string" ? b.message.trim() : "";
  const parts = [];
  if (serverMsg) parts.push(serverMsg);
  // The size gate puts its sentence in `error` ("HTML exceeds 1MB limit").
  const tooLarge = /exceeds .*limit/i.test(code) || code === "too_large";
  if (tooLarge && !serverMsg) parts.push(code === "too_large" ? "The HTML is over your plan's size limit." : `${code}.`);

  // A free account that sent a custom slug is rejected with 401 + upgrade copy.
  // Without naming it, this reads as a broken credential.
  const looksLikeSlugGate = /custom link|pick a custom|upgrade/i.test(serverMsg);

  if (tooLarge) {
    parts.push(
      `Free pages are capped at 1MB, Pro at 10MB, Studio/Agency at 50MB. Shrink it, or upgrade: ${PRICING_URL}`
    );
  } else if (code === "password_protection_not_allowed") {
    parts.push(`Password protection is a paid feature — retry without \`password\`, or upgrade: ${PRICING_URL}`);
  } else if (code === "invalid_password") {
    parts.push(`Use a password of ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`);
  } else if (status === 401 && looksLikeSlugGate) {
    parts.push("Custom slugs need a paid plan (Pro or above) — retry without `slug` to get a random one.");
  } else if (status === 401 && code === "invalid_api_key") {
    parts.push("Check HOSTHTML_API_KEY, or generate a new one at host-html.com → Account → API keys.");
  } else if (status === 401 && code === "project_anon_key_not_allowed") {
    parts.push("That is a project key, not a personal one. Set HOSTHTML_API_KEY to an `hh_…` key.");
  } else if (status === 401) {
    parts.push("Set HOSTHTML_API_KEY to a personal `hh_…` key from host-html.com → Account → API keys.");
  } else if (status === 403 && code === "email_not_verified") {
    parts.push("Confirm your email address, then retry.");
  } else if (status === 403 && code === "account_suspended") {
    parts.push("This account is suspended — contact info@host-html.com. Do not retry.");
  } else if (status === 403 && code === "page_limit_reached") {
    parts.push(`The free plan's page limit was reached. Delete a page, or upgrade: ${PRICING_URL}`);
  } else if (status === 409) {
    parts.push("That slug is already taken — choose another, or omit `slug` for a random one.");
  } else if (status === 429 || code === "rate_limited") {
    parts.push("Rate limited — wait a moment and retry.");
  } else if (status === 503) {
    parts.push("Transient server-side error — safe to retry once after a short pause.");
  } else if (status >= 500) {
    parts.push("The publish server returned an error. Retry shortly; if it persists, report it.");
  }

  if (!parts.length) parts.push(`Publish failed with HTTP ${status}.`);
  return parts.join(" ");
}

/**
 * Render a successful publish for the model.
 *
 * Deliberately omits `edit_token`: it is a bearer credential for mutating the
 * page, and an MCP tool result is transcript content that ends up pasted into
 * issues, logs and chat history.
 */
export function formatPublishResult(result) {
  const lines = [`Published: ${result.url}`];
  // `expires_at` is null on a paid plan, where the page never expires. The free
  // window is server-owned (3 days today, 10 and 5 before), so state the date
  // the server returned rather than a day count that goes stale in the package.
  if (result.expires_at) {
    lines.push(
      `This free page goes offline on ${new Date(result.expires_at).toISOString().slice(0, 10)} (UTC). ` +
        "Tell the user before they share it widely. To fix a mistake later, use update_page " +
        "with this slug: the link stays the same."
    );
    lines.push(`To keep it online permanently, the account owner can upgrade (Pro is $9/month): ${PRICING_URL}`);
  } else {
    lines.push("This page does not expire. To revise it later, use update_page: the link stays the same.");
  }
  return lines.join("\n");
}

/** Turn a non-2xx update-page-html response into one actionable sentence. */
export function mapUpdateError(status, body) {
  const b = body && typeof body === "object" ? body : {};
  const code = typeof b.error === "string" ? b.error : "";
  const serverMsg = typeof b.message === "string" ? b.message.trim() : "";
  const hint = {
    page_not_found: "No page has that slug. Check the slug, or publish it with publish_html.",
    not_authorized: "That page belongs to another account — an API key can only update its own pages.",
    html_editing_not_allowed:
      `This page can't be edited in place — free pages can only be updated while they are still online. Publish a new one with publish_html, or upgrade to keep pages permanently: ${PRICING_URL}`,
    too_large: `The HTML is over your plan's size limit (free 1MB, Pro 10MB, Studio/Agency 50MB). Upgrade: ${PRICING_URL}`,
    content_blocked: "The content was blocked by the abuse scanner. Do not retry the same HTML.",
    rate_limited: "Daily API write limit reached — try again tomorrow.",
    account_suspended: "This account is suspended — contact info@host-html.com. Do not retry.",
    invalid_body: "The request was malformed — pass `slug` and a non-empty `html`.",
  }[code];
  const parts = [];
  if (serverMsg) parts.push(serverMsg);
  if (hint) parts.push(hint);
  else if (status === 401) parts.push("Set HOSTHTML_API_KEY to a personal `hh_…` key from host-html.com → Account → API keys.");
  else if (status >= 500) parts.push("The update server returned an error. Retry shortly; if it persists, report it.");
  if (!parts.length) parts.push(`Update failed with HTTP ${status}.`);
  return parts.join(" ");
}

/** Hosted pages are served from the content domain (epic #141). */
export const PAGE_ORIGIN = "https://host-html-user.com";

/** Render a successful in-place update for the model. */
export function formatUpdateResult(result, slug) {
  const url = `${PAGE_ORIGIN}/p/${result?.slug || slug}`;
  const v = Number.isInteger(result?.version_number) ? ` (version ${result.version_number})` : "";
  return `Updated${v}: ${url}\nSame link as before — anyone who already has it sees the new version.`;
}
