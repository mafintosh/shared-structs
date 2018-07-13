# shared-structs

Share a struct backed by the same underlying buffer between C and JavaScript

```
npm install shared-struct
```

Useful for doing bulk updates of data in native modules with no context switching cost.

## Usage

``` js
const sharedStructs = require('shared-structs')

const structs = sharedStructs(`
  struct aStruct {
    int32_t i;
    char buf[1024];
    char someChar;
    int someInt;
  }
`)

const struct = structs.aStruct()

struct.i = 42
struct.buf[0] = 42

// pass this to c, and it will be able to parse it
console.log(struct.rawBuffer)
```

See [example/example.js](example/example.js) for more.

## API

#### `structs = sharedStructs(src)`

Parses the structs specified in the global scope of src
and returns JavaScript implementations of each.

Each property is exposed as a normal JavaScript property you can
get/set.

All changes are reflected in `.rawBuffer` which you can pass to a c program
and parse with the same struct.

## Writing strings

There is a small helper included in `require('shared-structs/strings')` that
allows you to encode/decode c style strings into char buffers

```js
const strings = require('shared-structs/strings')

// encode
strings.encode('hello world', struct.buf)

// decode
console.log(strings.decode(struct.buf))
```

## License

MIT
