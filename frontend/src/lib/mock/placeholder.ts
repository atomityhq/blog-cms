/**
 * Generated placeholder artwork for the mock media library — inline SVG data URIs,
 * so the seed needs no binary files and no external image host.
 */
export function placeholderImage(label: string, from: string, to: string, width = 1200, height = 630): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<g fill="none" stroke="rgba(3,3,3,0.08)" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<line x1="${(i + 1) * (width / 12)}" y1="0" x2="${(i + 1) * (width / 12)}" y2="${height}"/>`).join("")}</g>
<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, monospace" font-size="${Math.round(height / 14)}" font-weight="700" fill="rgba(3,3,3,0.72)" letter-spacing="2">${label.toUpperCase()}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
