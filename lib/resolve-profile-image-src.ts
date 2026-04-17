/** Shared by **`ProfileImage`** and **`ProfileCard`** header avatar. */
export function resolveProfileImageSrc(
  src: string | null | undefined,
  pathname: string | null | undefined,
): string | undefined {
  if (src) return src
  if (pathname) return `/api/file?pathname=${encodeURIComponent(pathname)}`
  return undefined
}
