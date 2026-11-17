import { SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'

const token = process.env.NEXT_PUBLIC_POSTHOG_KEY
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

if ((!token || !host) && process.env.NODE_ENV !== 'production') {
  const missingVariable = token ? 'NEXT_PUBLIC_POSTHOG_HOST' : 'NEXT_PUBLIC_POSTHOG_KEY'
  console.warn(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`)
}

export const posthogLogProvider = token && host
  ? new LoggerProvider({
      resource: resourceFromAttributes({ 'service.name': 'maitrecoif-web' }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${host.replace(/\/$/, '')}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
        }),
      ],
    })
  : undefined

const posthogLogLogger = posthogLogProvider?.getLogger('maitrecoif.posthog')

export function logPostHog(message: string, attributes: Record<string, string | number | boolean>) {
  posthogLogLogger?.emit({
    body: message,
    severityNumber: SeverityNumber.INFO,
    attributes,
  })
}

let shutdownHookRegistered = false

export function registerPostHogLogShutdown() {
  if (!posthogLogProvider || shutdownHookRegistered) return

  shutdownHookRegistered = true
  const shutdown = () => {
    void posthogLogProvider.shutdown().catch(() => {})
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
