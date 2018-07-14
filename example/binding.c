#include <node_api.h>
#include <napi-macros.h>
#include <string.h>

struct things {
  uint64_t a_number;
  char a_char;
  char input[61];
  char output[61];
  int operations;
};

NAPI_METHOD(tick) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(struct things *, t, 0)

  t->operations++;

  return NULL;
}

NAPI_METHOD(copy_string) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(struct things *, t, 0)

  t->operations++;
  memcpy(t->output, t->input, 61);

  return NULL;
}

NAPI_INIT() {
  NAPI_EXPORT_FUNCTION(copy_string)
  NAPI_EXPORT_FUNCTION(tick)
}
