module.exports = {
  input: [
    'src/**/*.{js,jsx}',
    'pages/**/*.{js,jsx}'
  ],
  output: './',
  options: {
    debug: true,
    removeUnusedKeys: true,
    func: {
      list: ['t'],
      extensions: ['.js', '.jsx']
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: ['.js', '.jsx'],
      fallbackKey: function (ns, value) {
        return value
      },
      acorn: {
        ecmaVersion: 10, // defaults to 10
        sourceType: 'module' // defaults to 'module'
        // Check out https://github.com/acornjs/acorn/tree/master/acorn#interface for additional options
      }
    },
    lngs: ['en', 'pt', 'pt-BR'],
    ns: [],
    defaultLng: 'en',
    defaultNs: 'common',
    defaultValue: (language, namespace, key) => key,
    resource: {
      loadPath: 'public/static/locales/{{lng}}/{{ns}}.json',
      savePath: 'public/static/locales/{{lng}}/{{ns}}.json',
      jsonIndent: 2,
      lineEnding: '\n'
    },
    nsSeparator: false, // namespace separator
    keySeparator: false, // key separator
    interpolation: {
      prefix: '{{',
      suffix: '}}'
    }
  }
}
