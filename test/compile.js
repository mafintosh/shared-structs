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
      int64_t i64;
      uint64_t u64;
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

  foo.i64 = -755n;
  t.same(foo.i64, -755n);

  foo.u64 = 777n;
  t.same(foo.u64, 777n);

  t.same(foo.rawBuffer.length, 33008)
  t.notSame(foo.rawBuffer, Buffer.alloc(33008))

  const fooClone = structs.foo(foo.rawBuffer)

  t.same(fooClone.a, 1)
  t.same(fooClone.e, 42)
  t.same(fooClone.b[0][10], 0.1)
  t.same(fooClone.c[0].buf[42], 10)
  t.same(fooClone.d[0][1][1].buf[100], 11)
  t.same(fooClone.i64, -755n);
  t.same(fooClone.u64, 777n);
  t.same(fooClone.rawBuffer.length, 33008)

  t.ok(fooClone.rawBuffer === foo.rawBuffer)

  t.end()
})

tape('view parse', function (t) {
  const structs = compile(`
    struct foo {
    uint32_t magic1;
    uint32_t magic2;
    uint32_t magic3;
    uint32_t magic4;
    uint32_t magic5;
    };
  `)

  const struct1 = structs.foo()

  struct1.magic1 = 1
  struct1.magic2 = 2
  struct1.magic3 = 3
  struct1.magic4 = 4
  struct1.magic5 = 5

  const tmp = Buffer.allocUnsafe(1) // to force unalignment of the next buf
  const buf = Buffer.allocUnsafe(struct1.rawBuffer.length)
  struct1.rawBuffer.copy(buf, 0)

  let struct2 = structs.foo(buf)

  t.same(struct1.magic1, struct2.magic1)
  t.same(struct1.magic2, struct2.magic2)
  t.same(struct1.magic3, struct2.magic3)
  t.same(struct1.magic4, struct2.magic4)
  t.same(struct1.magic5, struct2.magic5)

  t.end()
})

tape("signed_bytes", function (t) {
  const structs = compile(`
  struct foo {
    uint8_t ub;
    int8_t ib;
  };`);

  const foo = structs.foo();

  foo.ub = 200;
  foo.ib = -100;

  t.same(foo.ub, 200);
  t.same(foo.ib, -100);
  t.end();
});
