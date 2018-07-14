const tape = require('tape')
const parse = require('../parse')

tape('parse basic', function (t) {
  const structs = parse(`
    struct foo {
      int32_t i;
    };
  `)

  t.same(structs, [{
    node: 'struct',
    name: 'foo',
    alignment: 4,
    size: 4,
    fields: [{
      node: 'field',
      type: 'int32_t',
      name: 'i',
      struct: false,
      pointer: false,
      array: null,
      size: 4,
      offset: 0,
      alignment: 4
    }]
  }])

  t.end()
})

tape('parse basic with comments and noise', function (t) {
  const structs = parse(`
    #include "baz /* struct main {"

    // ' and stuff struct foobar {}
    /*
      struct bar {}
    */

    struct foo {
      int32_t i;
    };

    void main () {
      printf("struct baz {}");
      printf("\\"struct baa {}");
    }

    struct bax method () {
      struct inline {
        int tmp;
      }
    }
  `)

  t.same(structs, [{
    node: 'struct',
    name: 'foo',
    alignment: 4,
    size: 4,
    fields: [{
      node: 'field',
      type: 'int32_t',
      name: 'i',
      struct: false,
      pointer: false,
      array: null,
      size: 4,
      offset: 0,
      alignment: 4
    }]
  }])

  t.end()
})

tape('multi dim array', function (t) {
  const structs = parse(`
    struct foo {
      char buf[10][12]
    }
  `)

  t.same(structs, [{
    node: 'struct',
    name: 'foo',
    alignment: 1,
    size: 10 * 12,
    fields: [{
      node: 'field',
      type: 'char',
      name: 'buf',
      struct: false,
      pointer: false,
      array: [10, 12],
      size: 10 * 12,
      offset: 0,
      alignment: 1
    }]
  }])

  t.end()
})
