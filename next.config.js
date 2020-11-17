const withSass = require('@zeit/next-sass')
module.exports = withSass({
  env: {
    ENVIRONMENT: process.env.ENVIRONMENT,
    PAYPAL_ID: process.env.PAYPAL_ID
  },
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.node = {
        fs: 'empty'
      }
    }

    return config
  }
})
