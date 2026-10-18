// Umami Cloud (cookieless). The script in index.html only reports on the live site (data-domains)
// and has auto-tracking off, because the app navigates by URL hash, which Umami would not see.

type Payload = Record<string, unknown>
declare global {
  interface Window {
    umami?: { track: (a?: string | ((p: Payload) => Payload), data?: Payload) => void }
  }
}

/** run fn now if the deferred script has loaded, otherwise once it does */
function whenReady(fn: () => void) {
  if (window.umami) return fn()
  document.querySelector('script[data-website-id]')?.addEventListener('load', fn, { once: true })
}

/** page view for the current tab, e.g. /lid/#exam */
export function trackView() {
  const url = location.pathname + location.hash
  whenReady(() => window.umami?.track((p) => ({ ...p, url })))
}

export function trackEvent(name: string, data?: Payload) {
  whenReady(() => window.umami?.track(name, data))
}
