// features/editor/samplePage.js
// Preloaded into the editor so the workbench is never empty. It contains three
// deliberate problems: an image without alt, an input named only by its
// placeholder, and a heading that jumps from h1 to h3.

const PICTURE =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='120'>" +
  "<rect width='240' height='120' rx='12' fill='%236f4e37'/>" +
  "<circle cx='120' cy='60' r='36' fill='%23f5deb3'/></svg>";

export const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Café Aroma · Menu</title>
</head>
<body>
  <header>
    <h1>Café Aroma</h1>
  </header>
  <main>
    <img src="${PICTURE}" width="240" height="120">

    <h3>Today's specials</h3>
    <ul>
      <li>Filter coffee · ₹60</li>
      <li>Masala chai · ₹40</li>
    </ul>

    <h2>Join our newsletter</h2>
    <form>
      <input type="email" placeholder="Your email">
      <button type="submit">Subscribe</button>
    </form>
  </main>
</body>
</html>
`;

export const SAMPLE_CSS = `body {
  font-family: Georgia, serif;
  margin: 2rem;
  color: #3b2a20;
}
h1 {
  color: #6f4e37;
}
`;
