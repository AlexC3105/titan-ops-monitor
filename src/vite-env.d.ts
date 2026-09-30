/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Base URL of the TITAN API Worker. Defaults to the deployed Worker. */
  readonly VITE_TITAN_API_BASE?: string
}
