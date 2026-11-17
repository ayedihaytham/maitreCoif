import posthog from 'posthog-js'

import { nettoyerEvenement } from '@/lib/analytics-vie-privee'

const token = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (token) {
  posthog.init(token, {
    api_host: '/ingest',
    defaults: '2025-05-24',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
    before_send: nettoyerEvenement,
  })
} else if (process.env.NODE_ENV === 'development') {
  throw new Error('NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured')
}
