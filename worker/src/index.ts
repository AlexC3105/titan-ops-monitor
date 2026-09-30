import { createDeps, handle, type Deps } from './handler'

export interface Env {
  /** Comma-separated browser origins allowed to call the API (CORS). */
  ALLOWED_ORIGINS?: string
}

// One Deps per isolate so the in-memory cache survives between requests.
let deps: Deps | undefined

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    deps ??= createDeps({
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      edge: caches.default,
    })
    return handle(req, deps)
  },
} satisfies ExportedHandler<Env>
