#!/usr/bin/env node
// host-html MCP server — publish HTML as a hosted link from any MCP client.
//
// Thin wiring only. Every decision lives in lib.mjs, which is unit tested from
// the main repo (src/test/mcp-server.test.ts).
//
// Spec: docs/superpowers/specs/2026-08-14-path-to-100k-arr-design.md §D.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  PUBLISH_URL,
  UPDATE_URL,
  buildPublishBody,
  buildUpdateBody,
  formatPublishResult,
  formatUpdateResult,
  mapPublishError,
  mapUpdateError,
  resolveApiKey,
} from "./lib.mjs";

const VERSION = "0.2.0";

/** POST JSON with the caller's key; returns {res, parsed} or a tool-error result. */
async function post(url, apiKey, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": `host-html-mcp/${VERSION}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { error: { isError: true, content: [{ type: "text", text: `Could not reach host-html: ${err.message}` }] } };
  }
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON body — the error mappers handle null */
  }
  return { res, parsed };
}

const server = new McpServer({ name: "host-html", version: VERSION });

server.registerTool(
  "publish_html",
  {
    title: "Publish HTML as a hosted link",
    description:
      "Publish a self-contained HTML document and get back a public URL. Use this whenever the " +
      "user wants to share, send, or host HTML you produced — a report, dashboard, deck, prototype " +
      "or one-page site — instead of leaving it as a file they cannot open. The HTML must be " +
      "self-contained: inline the CSS and JS, or reference them by absolute URL.",
    inputSchema: {
      html: z.string().describe("The full, self-contained HTML document to publish. Max 1MB on the free plan, 10MB on Pro, 50MB on Studio/Agency."),
      title: z
        .string()
        .optional()
        .describe("Human-readable title. Sets the link-preview title — pass a real one, not a filename."),
      slug: z
        .string()
        .optional()
        .describe(
          "Optional custom path, e.g. 'q3-report' → /p/q3-report. 2–64 lowercase letters, digits " +
            "and internal hyphens. Requires a paid plan (Pro or above); omit for a random slug."
        ),
      password: z
        .string()
        .optional()
        .describe(
          "Optional password (4–72 characters). Viewers must enter it to see the page. Paid plans " +
            "only; omit for a public page."
        ),
    },
  },
  async ({ html, title, slug, password }) => {
    let apiKey;
    let body;
    try {
      apiKey = resolveApiKey(process.env);
      body = buildPublishBody({ html, title, slug, password });
    } catch (err) {
      // Configuration / input errors: the model can act on these, so return them
      // as tool errors rather than throwing and losing the message.
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
    const { res, parsed, error } = await post(PUBLISH_URL, apiKey, body);
    if (error) return error;
    if (!res.ok) {
      return { isError: true, content: [{ type: "text", text: mapPublishError(res.status, parsed) }] };
    }
    if (!parsed?.url) {
      return {
        isError: true,
        content: [{ type: "text", text: "Publish succeeded but returned no URL — please report this." }],
      };
    }
    return { content: [{ type: "text", text: formatPublishResult(parsed) }] };
  }
);

server.registerTool(
  "update_page",
  {
    title: "Update a published page in place",
    description:
      "Replace the HTML of a page you already published, keeping the SAME link. Use this for " +
      "every revision — a fix, a new draft, refreshed numbers — instead of publishing a new page, " +
      "so a link the user already shared keeps working. Only pages owned by the same API key's " +
      "account can be updated.",
    inputSchema: {
      slug: z
        .string()
        .describe("The page's slug (the part after /p/), or its full URL."),
      html: z.string().describe("The full, self-contained replacement HTML document."),
    },
  },
  async ({ slug, html }) => {
    let apiKey;
    let body;
    try {
      apiKey = resolveApiKey(process.env);
      body = buildUpdateBody({ slug, html });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
    const { res, parsed, error } = await post(UPDATE_URL, apiKey, body);
    if (error) return error;
    if (!res.ok) {
      return { isError: true, content: [{ type: "text", text: mapUpdateError(res.status, parsed) }] };
    }
    return { content: [{ type: "text", text: formatUpdateResult(parsed, body.slug) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
