export default function event (...args) {
  const isServer = typeof window === 'undefined'
  if (isServer || !window.gtag) {
    console.log(...args)
    return
  }

  window.gtag(...args)
}
