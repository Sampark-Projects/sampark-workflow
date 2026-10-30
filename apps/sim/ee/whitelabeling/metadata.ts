import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/core/utils/urls'
import { getBrandConfig } from '@/ee/whitelabeling/branding'

/**
 * Generate dynamic metadata based on brand configuration.
 *
 * The designer runs inside the ITSM host page, so it ships no product name, logo, social card or
 * favicon of its own. A deployment that sets `NEXT_PUBLIC_BRAND_NAME` or the favicon variable gets
 * them back in the tab title and icon.
 */
export function generateBrandedMetadata(override: Partial<Metadata> = {}): Metadata {
  const brand = getBrandConfig()

  return {
    title: {
      template: brand.isWhitelabeled ? `%s | ${brand.name}` : '%s',
      default: brand.name,
    },
    applicationName: brand.name,
    generator: 'Next.js',
    referrer: 'origin-when-cross-origin',
    metadataBase: new URL(getBaseUrl()),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-video-preview': -1,
        'max-snippet': -1,
      },
    },
    manifest: '/manifest.webmanifest',
    ...(brand.faviconUrl
      ? { icons: { icon: [{ url: brand.faviconUrl, sizes: 'any', type: 'image/png' }] } }
      : {}),
    formatDetection: {
      telephone: false,
    },
    ...override,
  }
}
