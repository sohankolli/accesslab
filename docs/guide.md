# AccessLab user guide

How each part of AccessLab works. For a short overview, see the [README](../README.md).

## Workbench features

- **Live audit.** An HTML/CSS editor (tabs, line numbers, caret position) feeds a sandboxed preview; 400 ms after you stop typing the page is re-rendered and checked again. Code that would make the page larger than 500 KB is refused.
- **Open files.** "Open file" (or dropping a file on the editor) loads an `.html` or `.htm` file into the HTML tab and a `.css` file into the CSS tab. The file is read in the browser and goes through the same 500 KB cap and sandboxed preview as pasted code. For a React, Vue or Angular app, paste the rendered page's outerHTML from the browser's developer tools.
- **Share links.** "Copy share link" packs the HTML and CSS into the link itself (`/audit#s=…`, compressed). The code sits in the URL fragment, which browsers never send to a server, so sharing uploads nothing. Links over 32,000 characters are not made.
- **Findings people can read.** Each finding has a plain title and says who it affects ("Screen reader users hear "image" and nothing else."), with the element, the rule, a link to the WCAG criterion and the fix. The score is also read as eye-chart acuity: 77 "reads at 20/30".
- **Eleven core rules** in two switchable packs (see the [rule catalogue](architecture.md#rule-catalogue)), each linked to its WCAG 2.2 success criterion.
- **Colour contrast with fixes.** Real WCAG relative-luminance maths, background resolution through translucent layers, and the nearest passing colour (same hue) as a one-click CSS fix.
- **Numbered marks.** Every finding is outlined on the preview with a numbered pin that matches its number in the list. Opening a finding scrolls the preview to it and highlights its source line in yellow; clicking an element in the preview opens its finding.
- **Score and history.** A weighted 0–100 score, the change since the last run, and a report page comparing any two of the last 20 runs of a page.
- **History by page.** Each saved run records which page was checked: its `<title>`, otherwise the opened file's name, otherwise "Untitled page". The Report's "Page" select shows one page's trend, history and before-and-after at a time, and the workbench's "since the last check" compares only with the same page. Runs saved before this change are kept as "Earlier checks". "Clear history" asks, in the page, whether to clear this page or all pages.
- **Model suggestions**: a trained model flags elements that look clickable but are not controls, which the rules cannot see. See [model.md](model.md).
- **Built to its own standard.** Set in Atkinson Hyperlegible (self-hosted); light, dark and system themes; every text colour passes WCAG AA in both (checked by a test with the engine's own contrast maths); 44 px touch targets; keyboard-resizable panes; and AccessLab scores 100 when its own engine audits its pages. The visual spec is [`docs/design/direction.html`](design/direction.html), with side-by-side fidelity checks in [`docs/design/fidelity/`](design/fidelity/).
- **Safe by design.** The audited page runs in an `<iframe sandbox="allow-same-origin">`: its own JavaScript never runs, and links or forms inside it cannot navigate the frame.

## Simulate

The Simulate page shows the workbench's current page in its own preview frame, a separate copy that is never audited. Choosing a lens restyles only that copy, so a lens can never change the audit, the score or the history. The workbench's numbered marks are drawn on the copy too, and stay on their elements under every lens.

- **Colour vision.** Protanopia, deuteranopia and tritanopia use the matrices of Machado, Oliveira and Fernandes (2009) at full severity, applied as an SVG `feColorMatrix` filter.
- **Low vision.** A `blur(2px) contrast(0.8)` filter: small and low-contrast text fails first.
- **200% text size.** Doubles the root font size. Text sized in `px` does not grow, which is exactly what this lens reveals.
- **Keyboard tab order.** The page's focusable elements in the order Tab visits them: positive `tabindex` values first, then document order.
- **Screen-reader view.** What a screen reader reads in browse mode, in page order: landmarks as they start and end, headings with their level, links, buttons and fields as "role, name", and the text between them. Hidden content and decorative images (`alt=""`) are skipped, and anything without a name reads "(no name)".

These are teaching aids, not clinical simulations or real assistive-technology output.

## Learn

The Learn page lists a guide for each of the eleven rules, grouped by pack. Each guide (`/learn/<rule-id>`) explains why the rule matters, how to fix it, and shows an example that needs fixing next to an improved one.

## Keyboard shortcuts

Press <kbd>?</kbd> anywhere outside a text field for the shortcut help; <kbd>Esc</kbd> closes it. Shortcuts are ignored while you type in a field or the editor.

| Keys                  | Action                             |
| --------------------- | ---------------------------------- |
| `Alt` + `Shift` + `H` | Go to Home                         |
| `Alt` + `Shift` + `W` | Go to the Workbench                |
| `Alt` + `Shift` + `S` | Go to Simulate (the vision lenses) |
| `Alt` + `Shift` + `R` | Go to the Report                   |
| `Alt` + `Shift` + `L` | Go to Learn                        |
| `?`                   | Open the shortcut help             |
| `Esc`                 | Close the shortcut help            |

## Check a live page

AccessLab includes a bookmarklet that lets you send the HTML and CSS of the website currently open in your browser directly to the Audit Workbench.

### Setup

1. Open the AccessLab home page.
2. Drag the **Check with AccessLab** link to your browser's bookmarks bar.
3. The bookmarklet is now saved and ready to use.

### How to use

1. Visit the website you want to audit.
2. Click **Check with AccessLab** in your bookmarks bar.
3. AccessLab opens the Audit Workbench and transfers the current page's HTML and readable CSS.
4. Review the accessibility audit results and fix identified issues.

### Notes and limitations

- Pages behind login are checked as they appear in your browser.
- Cross-origin stylesheets may not be readable due to browser security restrictions. These are skipped.
- Pages larger than 500 KB are rejected to protect existing editor content.
- If no page is received within a few seconds, AccessLab displays a timeout message.
- Some websites may restrict bookmarklet execution through browser security policies.
- Page scripts are not executed in the preview.
