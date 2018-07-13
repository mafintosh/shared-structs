const parse = require('./parse')
const genfun = require('generate-function')

module.exports = compile

function compile (src) {
  const structs = parse(src.toString())
  const cache = {}

  structs.forEach(function (s) {
    compileStruct(s, cache)
  })

  return cache
}

function compileStruct (s, cache) {
  const fn = genfun('class struct_%s {', s.name)

  fn('constructor (buffer, offset) {')
  fn('this.rawBuffer = buffer')
  fn('this.rawArrayBuffer = this.rawBuffer.buffer')

  s.fields.forEach(function (f) {
    const v = arrayView(f.type, f.offset, f.size)

    if (v) {
      if (f.array > -1) {
        fn('this.%s = %s', f.name, v)
      } else {
        fn('this._%s = %s', f.name, v)
      }
    } else if (f.struct) {
      if (f.array > -1) {
        fn('this.%s = [', f.name)
        for (var i = 0; i < f.array; i++) {
          fn('%s(this.rawBuffer, offset + %i)%s', f.type, f.offset + i * (f.size / f.array), i < f.array - 1 ? ',' : '')
        }
        fn(']')
      } else {
        fn('this.%s = %s(this.rawBuffer, offset + %i)', f.name, f.type, f.offset)
      }
    }
  })

  fn('}')

  s.fields.forEach(function (f) {
    if (f.array > -1 || !arrayType(f.type)) return

    fn('get %s () {', f.name)
      ('return this._%s[0]', f.name)
    ('}')

    fn('set %s (val) {', f.name)
      ('this._%s[0] = val', f.name)
    ('}')
  })

  fn('}')

  var compiled = null
  cache[s.name] = alloc
  alloc.bytes = s.size
  alloc.toString = toString

  return alloc

  function toString () {
    if (!compiled) compiled = fn.toFunction(cache)
    return compiled.toString()
  }

  function alloc (buf, offset) {
    if (!buf) buf = Buffer.alloc(s.size)
    if (!offset) offset = 0
    if (!compiled) compiled = fn.toFunction(cache)
    return new compiled(buf, offset)
  }
}

function arrayView (type, offset, size) {
  const a = arrayType(type)
  if (!a) return null
  if (a === 'Buffer') return 'this.rawBuffer.slice(offset + ' + offset + ', offset + ' + (offset + size) + ')'
  return 'new ' + a + '(this.rawArrayBuffer, offset + ' + offset + ', ' + (size / typeSize(a)) + ')'
}

function typeSize (a) {
  switch (a) {
    case 'Uint32Array':
    case 'Int32Array':
    return 4

    case 'Uint16Array':
    case 'Int16Array':
    return 2
  }

  return 0
}

function arrayType (type) {
  switch (type) {
    case 'int':
    case 'int32_t':
    return 'Int32Array'

    case 'uint8_t':
    case 'bool':
    case 'byte':
    case 'int8_t':
    case 'char':
    return 'Buffer'

    case 'int16_t':
    return 'Int16Array'

    case 'uint':
    case 'uint32_t':
    return 'Uint32Array'

    case 'uint16_t':
    return 'Uint16Array'
  }

  return null
}
