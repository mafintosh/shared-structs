exports.encode = function (s, buf, offset) {
  if (!buf) buf = Buffer.alloc(exports.encodingLength(s))
  if (!offset) offset = 0
  const oldOffset = offset
  offset += buf.write(s, offset)
  buf[offset++] = 0
  exports.encode.bytes = oldOffset - offset
  return buf
}

exports.encodingLength = function (s) {
  return Buffer.byteLength(s) + 1
}

exports.decode = function (buf, offset) {
  if (offset) buf = buf.slice(offset)
  var i = buf.indexOf(0)
  if (i === -1) i = buf.length
  exports.bytes = i + 1
  return buf.toString('utf-8', 0, i)
}
