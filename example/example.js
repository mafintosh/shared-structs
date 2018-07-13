const binding = require('node-gyp-build')(__dirname)
const path = require('path')
const fs = require('fs')
const sharedStructs = require('../')
const string = require('../string')

const structs = sharedStructs(fs.readFileSync(path.join(__dirname, 'binding.c')))

const things = structs.things()

things.operations = 1
binding.tick(things.rawBuffer)

string.encode('hello world\n', things.input)
binding.copy_string(things.rawBuffer)
console.log(things.operations, string.decode(things.output))
