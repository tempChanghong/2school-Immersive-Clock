// 颜色工具：#rrggbb/#rgb 转 rgba(r,g,b,a)
export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return hex;
  const h = hex.trim();
  const clampA = Math.max(0, Math.min(1, alpha));
  const short = /^#([A-Fa-f0-9]{3})$/;
  const long = /^#([A-Fa-f0-9]{6})$/;
  
  if (short.test(h)) {
    const m = h.match(short)!;
    const r = parseInt(m[1][0] + m[1][0], 16);
    const g = parseInt(m[1][1] + m[1][1], 16);
    const b = parseInt(m[1][2] + m[1][2], 16);
    return `rgba(${r}, ${g}, ${b}, ${clampA})`;
  }
  
  if (long.test(h)) {
    const m = h.match(long)!;
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampA})`;
  }
  
  return h;
}
