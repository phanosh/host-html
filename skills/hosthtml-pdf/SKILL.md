---
name: hosthtml-pdf
description: Export host-html slide decks to PDF using Puppeteer
version: 1.0.0
triggers:
  - /host-pdf
---

# host-pdf: Export HTML Slides to PDF

When the user runs `/host-pdf`, follow these steps:

## Step 1: Find the HTML slide deck

Look for the HTML file to export. Check in this order:
1. If the user specifies a file path (e.g., `/host-pdf presentation.html`), use that file
2. If there's a recently generated/modified `.html` file in the current project, use that
3. Ask the user which HTML file to export

The HTML file must contain slide elements with the class `.slide` — this is the standard format produced by host-html slide decks.

## Step 2: Ensure Puppeteer is available

Check that Puppeteer and its Chrome browser are installed:

```bash
npm ls puppeteer 2>/dev/null || npm install puppeteer
npx puppeteer browsers install chrome 2>/dev/null
```

These commands are safe to run even if already installed.

## Step 3: Run the export script

The export script is bundled with this skill. Run it:

```bash
node "<SKILL_DIR>/export-pdf.mjs" "<INPUT_HTML>" "<OUTPUT_PDF>"
```

- `<SKILL_DIR>` is the directory containing this SKILL.md file (i.e., the `skills/hosthtml-pdf/` directory inside the host-html package)
- `<INPUT_HTML>` is the absolute path to the HTML file from Step 1
- `<OUTPUT_PDF>` (optional) defaults to the same name/location as the input but with a `.pdf` extension

**Optional flags:**
- `--slides N` — override the auto-detected slide count (useful if slides don't use the `.slide` class)

Example:

```bash
node "/path/to/skills/hosthtml-pdf/export-pdf.mjs" ./deck.html ./deck.pdf
```

## Step 4: Present the result

Once the script finishes, show the user:
1. **PDF path**: The absolute path to the generated PDF
2. **Slide count**: How many slides were captured
3. **File size**: The size of the generated PDF

Format the output clearly:

```
PDF exported!

File: /path/to/deck.pdf
Slides: 8
Size: 2.4 MB
```

## Error Handling

- **"No .slide elements found"**: The HTML doesn't use `.slide` class divs. Ask the user how many slides to capture and retry with `--slides N`
- **Puppeteer launch failure**: Suggest running `npx puppeteer browsers install chrome` to install the browser
- **Timeout or blank captures**: The HTML may need more time to render — the script already waits 2s for initial load and 900ms per slide, which handles most cases

## Tips

- The script captures at 2× device scale (retina quality) at 1280×720 — the PDF will be crisp
- Each slide is screenshot-based, so all CSS animations, custom fonts, and backgrounds are preserved exactly as rendered
- If the user wants to share the PDF online, suggest combining with `/host-html` to also publish the live version
