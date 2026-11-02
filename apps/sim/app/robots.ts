import type { MetadataRoute } from 'next'

const DISALLOWED_PATHS = [
  '/api/',
  '/workspace/',
  '/playground/',
  '/resume/',
  '/invite/',
  '/unsubscribe/',
  '/w/',
  '/_next/',
  '/private/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS },
  }
}
