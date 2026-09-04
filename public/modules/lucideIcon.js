// Standalone Lucide icon rendering — deliberately has zero dependency on
// graph3d.js/three.js, so app.js's general-purpose iconSvg() (used for nav
// rail icons etc., not just the 3D graph) doesn't drag in the whole 3D
// library just to draw an <svg>.

// render a Lucide icon name to an inline <svg> string (empty if the lib/name is missing)
export function lucideSvg(name) {
  const L = typeof window !== 'undefined' && window.lucide;
  if (!L || !L.icons || !name) return '';
  const pascal = String(name).split(/[-_]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  const data = L.icons[pascal];
  if (!data) return '';
  const el = L.createElement(data);
  el.setAttribute('width', '1em');
  el.setAttribute('height', '1em');
  return el.outerHTML;
}
