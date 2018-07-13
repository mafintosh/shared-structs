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

function postProcess (v, structs) {
  if (v.size > 0) return v.size

  if (v.node === 'struct') {
    var offset = 0
    for (var i = 0; i < v.fields.length; i++) {
      const f = v.fields[i]
      postProcess(f, structs)
      v.alignment = Math.max(f.alignment, v.alignment)
      offset = align(offset, f.alignment)
      f.offset = offset
      offset += f.size
    }
    v.size = align(offset, v.alignment)
    return
  }

  if (v.node !== 'decl') return

  var size = 0
  if (v.pointer) {
    v.alignment = size = SIZEOF_PTR
  } else if (PRIMITIVE_SIZES[v.type]) {
    v.alignment = size = PRIMITIVE_SIZES[v.type]
  } else {
    const struct = lookupStruct(v.type, structs)
    v.alignment = struct.alignment
    size = struct.size
    v.struct = true
  }

  if (v.array > -1) v.size = v.array * size
  else v.size = size
}

function lookupStruct (type, structs) {
  for (var i = 0; i < structs.length; i++) {
    if (structs[i].name === type) return structs[i]
  }
  throw new Error('Unknown struct: ' + type)
}

function trimComments (str) {
  str = str.replace(/\/\/.+\n/g, '')
  return str
}

function parse (str) {
  const tokens = trimComments(str).split(/(;|\s+)/gm).filter(s => !/^(;|\s)*$/.test(s)).reverse()
  const structs = []

  while (tokens.length) parseNext()
  structs.forEach(s => postProcess(s, structs))
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
    const field = {node: 'decl', type: pop(), name: null, size: 0, offset: 0, array: -1, struct: false, pointer: false, alignment: 1}

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
      field.array = Number(arr) // TODO: support constants
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
}

function validId (n) {
  return /^[a-z_]([a-z0-9_])*$/i.test(n)
}
