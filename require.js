const fs = require('fs')
const path = require('path')
const compile = require('./')

delete require.cache[__filename]

module.exports = function (files, opts) {
  const dirname = path.dirname(module.parent.filename)
  const src = (Array.isArray(files) ? files : [files])
    .map(name => fs.readFileSync(path.join(dirname, name), 'utf-8'))
    .join('\n')

  return compile(src, opts)
}
