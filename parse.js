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
    {start: '"', end: '"', index: -1},
    {start: '/*', end: '*/', index: -1},
    {start: '//', end: '\n', index: -1}
  ]

  while (true) {
    const token = nextToken()
    if (!token) return str
    str = str.slice(0, token.index) + 'X' + str.slice(nextEnd(token))
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
  const tokens = filter(str).split(/(;|\s+)/gm).filter(s => !/^(;|\s)*$/.test(s)).reverse()
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
    if (next === '#define') return parseDefine()

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

  function parseDefine () {
    const name = pop()
    if (!validId(name)) throw new Error('Invalid define: ' + name)
    const value = pop()
    defines[name] = value
    return null
  }

  function resolveValue (name) {
    if (defines.hasOwnProperty(name)) return resolveValue(defines[name])
    if (/^\d+(\.\d+)?$/.test(name)) return Number(name)
    return name
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
    const field = {node: 'field', type: pop(), name: null, size: 0, offset: 0, array: -1, struct: false, pointer: false, alignment: 1}

    if (field.type === '}') return null

    if (field.type === 'struct') {
      field.struct = true
      field.type = pop()
    }

    if (!validId(field.type)) throw new Error('Invalid struct field type: ' + field.type)

    var name = pop()

    if (name === '*') {
      field.pointer = true
      name = pop()
    }

    const arr = (name.match(/\[([^\]]+)\]$/) || [null, null])[1]

    if (arr) {
      field.name = name.slice(0, name.lastIndexOf('['))
      field.array = resolveValue(arr)
    } else {
      field.name = name
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
      v.size = align(offset, v.alignment)
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

    if (v.array > -1) v.size = v.array * size
    else v.size = size
  }

  function lookupStruct (type) {
    for (var i = 0; i < structs.length; i++) {
      if (structs[i].name === type) return structs[i]
    }
    throw new Error('Unknown struct: ' + type)
  }
}

function validId (n) {
  return /^[a-z_]([a-z0-9_])*$/i.test(n)
}
