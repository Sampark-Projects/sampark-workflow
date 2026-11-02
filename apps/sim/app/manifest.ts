import type { MetadataRoute } from 'next'
import { WORKSPACES_PATH } from '@/lib/navigation/paths'
import { getBrandConfig } from '@/ee/whitelabeling'

export const dynamic = 'force-dynamic'

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrandConfig()

  return {
    name: brand.name,
    short_name: brand.name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: brand.theme?.primaryColor || '#33C482',
    orientation: 'portrait-primary',
    shortcuts: [
      {
        name: 'Create Workflow',
        short_name: 'New',
        description: 'Open the workflow designer',
        url: WORKSPACES_PATH,
      },
    ],
    lang: 'en-US',
    dir: 'ltr',
  }
}
