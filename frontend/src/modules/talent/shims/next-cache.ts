/**
 * src/shims/next-cache.ts
 * No-op stub — in the Vite+FastAPI setup cache revalidation is not needed
 */
export function revalidatePath(_path: string) {
    // no-op in browser context
}

export function revalidateTag(_tag: string) {
    // no-op
}
