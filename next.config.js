const { i18n } = require('./next-i18next.config')

module.exports = {
  i18n,
  env: {
    ENVIRONMENT: process.env.ENVIRONMENT,
    PAYPAL_ID: process.env.PAYPAL_ID,
    BACKEND_URL: process.env.BACKEND_URL
  }
}
