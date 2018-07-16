const SIZEOF_PTR = process.arch === 'x64' ? 8 : 4
const PRIMITIVE_SIZES = {
  uint: 4,
  uint8_t: 1,
  uint16_t: 2,
  uint32_t: 4,
  uint64_t: 8,
  int: 4,
  int8_t: 1,
  int16_t: 2,
  int32_t: 4,
  int64_t: 8,
  char: 1,
  byte: 1,
  bool: 1,
  float: 4,
  double: 8
}

module.exports = parse

function align (n, a) {
  const rem = n & (a - 1)
  if (!rem) return n
  return n + (a - rem)
}

function filter (str) {
  const tokens = [
    {start: '"', end: '"', index: -1, replace: "''"},
    {start: '/*', end: '*/', index: -1, replace: ''},
    {start: '//', end: '\n', index: -1, replace: '\n'}
  ]

  while (true) {
    const token = nextToken()
    if (!token) return str
    str = str.slice(0, token.index) + token.replace + str.slice(nextEnd(token))
  }

  function nextEnd (token) {
    var index = token.index + token.start.length

    while (true) {
      index = str.indexOf(token.end, index)
      if (index === -1) return str.length
      if (str[index - 1] !== '\\') return index + token.end.length
      index++
    }
  }

  function nextToken () {
    var min = null

    tokens.forEach(function (token) {
      token.index = str.indexOf(token.start)
      if (token.index > -1 && (!min || min.index > token.index)) min = token
    })

    return min
  }
}

function assign (def, obj) {
  if (!obj) return def
  return Object.assign({}, def, obj)
}

function parse (str, opts) {
  if (!opts) opts = {}

  const alignments = opts.alignments || {}
  const defines = assign({}, opts.defines)
  const sizes = assign(PRIMITIVE_SIZES, opts.sizes)
  const tokens = resolveStatic(filterDefines(filter(str), defines), defines)
    .split(/(;|\s+)/gm)
    .filter(s => !/^(;|\s)*$/.test(s))
    .reverse()

  const structs = []
  while (tokens.length) parseNext()
  structs.forEach(postProcess)
  return structs

  function pop () {
    const top = tokens.pop()
    if (top === '()' || top === '(' || top === ')') return pop()
    if (top.length > 1 && top[0] === '*') {
      tokens.push(top.slice(1))
      return '*'
    }
    if (top.length > 1 && top[top.length - 1] === '*') {
      tokens.push(top.slice(0, -1))
      return '*'
    }
    if (top === '{}') {
      tokens.push('}')
      return '{'
    }
    return top
  }

  function parseNext () {
    const next = pop()

    if (next === 'struct') return parseStruct()
    if (next === 'typedef') return parseTypedef()
    if (next === '{') return skipBlock()

    return null
  }

  function skipBlock () {
    var depth = 1
    while (tokens.length && depth) {
      const next = pop()
      if (next === '{') depth++
      else if (next === '}') depth--
    }
    return null
  }

  function parseStruct () {
    const result = {node: 'struct', name: null, size: 0, alignment: 1, fields: []}
    const name = pop()

    if (name !== '{') {
      result.name = name
      if (pop() !== '{') return null
    }

    var field = null
    while ((field = parseStructField()) !== null) result.fields.push(field)
    structs.push(result)

    return result
  }

  function parseStructField () {
    const field = {node: 'field', type: pop(), name: null, size: 0, offset: 0, array: null, struct: false, pointer: false, alignment: 1}

    if (field.type === '}') return null

    if (field.type === 'struct') {
      field.struct = true
      field.type = pop()
    }

    if (!validId(field.type)) throw new Error('Invalid struct field type: ' + field.type)

    field.name = pop()

    if (field.name === '*') {
      field.pointer = true
      field.name = pop()
    }

    var index = field.name.length
    while ((index = field.name.lastIndexOf('[', index)) > -1) {
      const end = field.name.indexOf(']', index)
      if (end === -1) throw new Error('Invalid struct field array: ' + field.name)
      const val = field.name.slice(index + 1, end)
      field.name = field.name.slice(0, index)
      index--

      if (!field.array) field.array = []
      field.array.unshift(resolveUint(val))
    }

    if (!validId(field.name)) throw new Error('Invalid struct field name: ' + field.name)

    return field
  }

  function parseTypedef () {
    const value = parseNext()
    const name = pop()
    if (!validId(name)) throw new Error('Invalid typedef name: ' + name)
    if (value.node === 'struct') value.name = name
    return value
  }

  function postProcess (v) {
    if (v.size > 0) return v.size

    if (v.node === 'struct') {
      var offset = 0
      for (var i = 0; i < v.fields.length; i++) {
        const f = v.fields[i]
        postProcess(f)
        v.alignment = Math.max(f.alignment, v.alignment)
        offset = align(offset, f.alignment)
        f.offset = offset
        offset += f.size
      }
      if (alignments[v.type]) v.alignment = alignments[v.type]
      v.size = sizes[v.type] || align(offset, v.alignment)
      return
    }

    if (v.node !== 'field') return

    var size = 0
    if (v.pointer) {
      v.alignment = size = sizes['*'] || SIZEOF_PTR
    } else if (sizes[v.type]) {
      size = sizes[v.type]
      v.alignment = alignments[v.type] || size
    } else {
      const struct = lookupStruct(v.type)
      v.alignment = struct.alignment
      size = struct.size
      v.struct = true
    }

    if (v.array) v.size = v.array.reduce(times) * size
    else v.size = size
  }

  function lookupStruct (type) {
    for (var i = 0; i < structs.length; i++) {
      if (structs[i].name === type) return structs[i]
    }
    throw new Error('Unknown struct: ' + type)
  }
}

function resolveStatic (src, defines) {
  if (!/^\w+$/.test(src) || defines.hasOwnProperty(src)) {
    const keys = Object.keys(defines)
    for (var i = 0; i < keys.length; i++) {
      const key = keys[i]
      const reg = new RegExp('([^\\w])' + key + '([^\\w])', 'g')
      src = src.replace(reg, function (_, start, end) {
        return start + resolveStatic(defines[key], defines) + end
      })
    }
  }

  src = src.replace(/\[([^\]]+)\]/g, function (_, num) {
    if (/^\d+$/.test(num)) return _
    if (/^[0-9+\-*/>< ()&]+$/.test(num)) return '[' + evalNumber(num) + ']'
    return _
  })

  return src
}

function resolveUint (name) {
  if (/^\d+$/.test(name)) return Number(name)
  throw new Error('Expected ' + name + ' to be an unsigned integer')
}

function filterDefines (src, defines) {
  return src.replace(/#define\s+(\S+)+\s+(\S+)/g, function (_, name, val) {
    if (!defines.hasOwnProperty(name)) defines[name] = val
    return ''
  })
}

function times (a, b) {
  return a * b
}

function validId (n) {
  return /^[a-z_]([a-z0-9_])*$/i.test(n)
}

function evalNumber (expr) {
  return new Function('return (' + expr + ')')()
}
