export const CONTRAST = `(() => {
  const lum = (c) => {
    const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const parse = (str) => {
    const m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  // A translucent scrim over unknown imagery: the honest test is the worst
  // case. Light text is worst off over the palest possible photo, dark text
  // over the darkest, so composite the scrim against that extreme.
  const worstCase = (c, fgLum) => over(c, fgLum > 0.35 ? [255, 255, 255] : [0, 0, 0]);
  const bgOf = (el, fgLum) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (n.classList.contains("glass")) {
        const g = parse(s.backgroundColor);
        if (g && g.a > 0) return worstCase(g, fgLum);
      }
      // Text over a photograph: the effective background is the pixels, not a
      // computed colour. Not statically checkable — skip rather than lie.
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      // Same, for imagery layered as a sibling element rather than a
      // background: a hero photo, a map canvas, a scrim over either.
      if (
        (s.position === "relative" || s.position === "absolute") &&
        n.querySelector("img, canvas, video, .maplibregl-map")
      ) {
        return null;
      }
      const c = parse(s.backgroundColor);
      if (c && c.a > 0.85) return c.rgb;
      // Anything translucent or over imagery: unknowable statically, skip.
      if (c && c.a > 0) return null;
      n = n.parentElement;
    }
    const c = parse(getComputedStyle(document.body).backgroundColor);
    return c ? c.rgb : [255, 255, 255];
  };
  const fails = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[aria-hidden='true'], svg, .maplibregl-map")) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!txt) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || +st.opacity < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fg = parse(st.color);
    if (!fg) continue;
    const bg = bgOf(el, lum(fg.rgb));
    if (!bg) continue;
    const f = over(fg, bg);
    const L1 = lum(f), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(st.fontSize);
    const bold = +st.fontWeight >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio < need - 0.01) {
      const key = st.color + "|" + txt.slice(0, 30);
      if (seen.has(key)) continue;
      seen.add(key);
      fails.push({ txt: txt.slice(0, 52), ratio: +ratio.toFixed(2), need, px: +px.toFixed(1), color: st.color, cls: (el.className.baseVal ?? el.className ?? "").toString().slice(0, 60) });
    }
  }
  return fails;
})()`;
