export default function event (...args) {
  const isServer = typeof window === 'undefined'
  if (isServer || !window.gtag) {
    return
  }

  window.gtag(...args)
}
