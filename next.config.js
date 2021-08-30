const path = require('path')
const withSass = require('@zeit/next-sass')

module.exports = withSass({
  env: {
    ENVIRONMENT: process.env.ENVIRONMENT,
    PAYPAL_ID: process.env.PAYPAL_ID,
    BACKEND_URL: process.env.BACKEND_URL
  },
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.node = {
        fs: 'empty'
      }
    }

    if (!isServer && config.mode === 'development') {
      const { I18NextHMRPlugin } = require('i18next-hmr/plugin')
      config.plugins.push(
        new I18NextHMRPlugin({
          localesDir: path.resolve(__dirname, 'public/static/locales')
        })
      )
    }

    return config
  }
})
