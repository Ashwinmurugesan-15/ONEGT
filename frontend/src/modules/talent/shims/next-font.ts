/**
 * src/shims/next-font.ts
 * Stub for legacy font loader — just returns the font family name
 */
export function Inter(_opts?: { subsets?: string[]; weight?: string[] }) {
    return { className: 'font-inter', style: { fontFamily: 'Inter, sans-serif' } };
}

export function Geist(_opts?: any) {
    return { className: '', variable: '--font-geist' };
}

export function GeistMono(_opts?: any) {
    return { className: '', variable: '--font-geist-mono' };
}

export default { Inter, Geist, GeistMono };
