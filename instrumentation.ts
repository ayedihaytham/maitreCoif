import { registerPostHogLogShutdown } from '@/lib/posthog-logs'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    registerPostHogLogShutdown()
  }
}
