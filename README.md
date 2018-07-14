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

Also supports nested structs, multidimensional arrays and most other things you'd normally use in c!

See [example/example.js](example/example.js) for more.

## API

#### `structs = sharedStructs(src, [options])`

Parses the structs specified in the global scope of src
and returns JavaScript implementations of each.

Each property is exposed as a normal JavaScript property you can
get/set.

All changes are reflected in `.rawBuffer` which you can pass to a c program
and parse with the same struct.

If you want to pass a nested struct to c, use the `.rawBufferSlice` to get a pointer
directly to this struct instead of `.rawBuffer`.

If you are using this with a native module, make sure to keep a reference to the allocated
struct in JavaScript (unless you know what you are doing) to avoid the buffer getting garbage
collected, while you are still using it in your native code.

Options include:

```js
{
  defines: {
    CUSTOM_DEFINE_HERE: 42 // add a custom define is defined elsewhere
  },
  sizes: {
    foo: 1024 // set the size of struct foo if defined elsewhere
  },
  alignment: {
    foo: 8 // set the alignment of struct foo if defined elsewhere
  }
}
```

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
