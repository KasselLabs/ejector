import React from 'react'

import NextHead from 'next/head'

export default function Head ({ title }) {
  return (
    <NextHead>
      <title>{ title }</title>
      <meta property="og:title" content="Ejector" />
      <meta property="og:type" content="website" />
      <meta property="og:description" content="Create an Among Us ejection animation for fun!" />
      <meta property="og:image" content="https://ejector.kassellabs.io/og-image.png" />
      <meta property="og:image:width" content="200" />
      <meta property="og:image:height" content="200" />
      <meta property="og:url" content="https://ejector.kassellabs.io" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Ejector" />
      <meta name="twitter:description" content="Create an Among Us ejection animation for fun!" />
      <meta name="twitter:image" content="https://ejector.kassellabs.io/twitter-card.png"/>
    </NextHead>
  )
}
