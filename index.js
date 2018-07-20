const parse = require('./parse')
const genfun = require('generate-function')

module.exports = compile

function compile (src, opts) {
  if (!opts) opts = {}

  const structs = parse(src.toString(), opts)
  const cache = {}

  structs.forEach(function (s) {
    compileStruct(s, cache, opts)
  })

  return cache
}

function sep (i, len) {
  return i < len - 1 ? ',' : ''
}

function compileArray (fn, f) {
  var offset = f.offset
  var size = f.size
  const primitive = arrayType(f.type)
  const fin = primitive ? f.array.length - 1 : f.array.length
  for (var i = 0; i < fin; i++) size /= f.array[i]

  fn('this.%s = [', f.name)
  visit(0, '')
  fn(']')

  function visit (i, s) {
    const len = f.array[i]
    if (i === fin) {
      if (primitive) fn('%s%s', arrayView(f.type, offset, size), s)
      else if (offset) fn('%s(this.rawBuffer, offset + %i)%s', f.type, offset, s)
      else fn('%s(this.rawBuffer, offset)%s', f.type, s)
      offset += size
    } else {
      if (i) fn('[')
      for (var j = 0; j < len; j++) visit(i + 1, sep(j, len))
      if (i) fn(']%s', s)
    }
  }
}

function compileStruct (s, cache, opts) {
  const skip = opts.skip || {}
  if (skip[s.name]) return

  const fn = genfun('class struct_%s {', s.name)

  fn('constructor (buffer, offset) {')
  fn('this.rawBuffer = buffer')
  fn('this.rawBufferSlice = buffer.slice(offset)')
  fn('this.rawArrayBuffer = this.rawBuffer.buffer')

  s.fields.forEach(function (f) {
    if (skip[s.name + '.' + f.name]) return
    if (f.pointer) return

    const v = arrayView(f.type, f.offset, f.size)

    if (v) {
      if (f.array) {
        if (f.array.length === 1) fn('this.%s = %s', f.name, v)
        else compileArray(fn, f)
      } else {
        fn('this._%s = %s', f.name, v)
      }
    } else if (f.struct) {
      if (f.array) {
        compileArray(fn, f)
      } else {
        fn('this.%s = %s(this.rawBuffer, offset + %i)', f.name, f.type, f.offset)
      }
    }
  })

  fn('}')

  s.fields.forEach(function (f) {
    if (skip[s.name + '.' + f.name]) return
    if (f.array || !arrayType(f.type) || f.pointer) return

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
  if (a === 'Buffer') {
    if (!offset) return 'this.rawBuffer.slice(offset, offset + ' + size + ')'
    return 'this.rawBuffer.slice(offset + ' + offset + ', offset + ' + (offset + size) + ')'
  }
  if (!offset) return 'new ' + a + '(this.rawArrayBuffer, offset, ' + (size / typeSize(a)) + ')'
  return 'new ' + a + '(this.rawArrayBuffer, offset + ' + offset + ', ' + (size / typeSize(a)) + ')'
}

function typeSize (a) {
  switch (a) {
    case 'Float64Array':
    return 8

    case 'Float32Array':
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
    case 'float':
    return 'Float32Array'

    case 'double':
    return 'Float64Array'

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
