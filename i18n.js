const NextI18Next = require('next-i18next').default
const path = require('path')

const nextI18Next = new NextI18Next({
  defaultLanguage: 'en',
  otherLanguages: ['pt', 'pt-BR'],
  localePath: path.resolve('./public/static/locales')
})

if (process.env.NODE_ENV !== 'production') {
  const { applyClientHMR } = require('i18next-hmr')
  applyClientHMR(nextI18Next.i18n)
}

module.exports = nextI18Next
