const tape = require('tape')
const compile = require('../')

tape('basic', function (t) {
  const structs = compile(`
    struct foo {
      int32_t a;
    }
  `)

  const foo = structs.foo()

  foo.a = 42
  t.same(foo.a, 42)
  t.same(foo.rawBuffer.length, 4)
  t.notSame(foo.rawBuffer, Buffer.alloc(4))

  const fooClone = structs.foo(foo.rawBuffer)

  t.same(fooClone.a, 42)
  t.ok(fooClone.rawBuffer === foo.rawBuffer)

  t.end()
})

tape('complex', function (t) {
  const structs = compile(`
    #define BUF_SIZE 2001

    typedef struct {
      char buf[BUF_SIZE];
    } bar;

    struct foo {
      char a;
      double b[10][12];
      bar c[10];
      bar d[1][2][3];
      int e;
    };
  `)

  const foo = structs.foo()

  foo.a = 1
  t.same(foo.a, 1)

  foo.e = 42
  t.same(foo.e, 42)

  foo.b[0][10] = 0.1
  t.same(foo.b[0][10], 0.1)

  foo.c[0].buf[42] = 10
  t.same(foo.c[0].buf[42], 10)

  foo.d[0][1][1].buf[100] = 11
  t.same(foo.d[0][1][1].buf[100], 11)

  t.same(foo.rawBuffer.length, 32992)
  t.notSame(foo.rawBuffer, Buffer.alloc(32992))

  const fooClone = structs.foo(foo.rawBuffer)

  t.same(fooClone.a, 1)
  t.same(fooClone.e, 42)
  t.same(fooClone.b[0][10], 0.1)
  t.same(fooClone.c[0].buf[42], 10)
  t.same(fooClone.d[0][1][1].buf[100], 11)
  t.same(fooClone.rawBuffer.length, 32992)

  t.ok(fooClone.rawBuffer === foo.rawBuffer)

  t.end()
})
