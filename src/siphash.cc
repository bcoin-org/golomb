#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "siphash.h"

#define ROTL(x, b) (uint64_t)(((x) << (b)) | ((x) >> (64 - (b))))

#define SIPROUND do { \
  v0 += v1; v1 = ROTL(v1, 13); v1 ^= v0; \
  v0 = ROTL(v0, 32); \
  v2 += v3; v3 = ROTL(v3, 16); v3 ^= v2; \
  v0 += v3; v3 = ROTL(v3, 21); v3 ^= v0; \
  v2 += v1; v1 = ROTL(v1, 17); v1 ^= v2; \
  v2 = ROTL(v2, 32); \
} while (0)

static inline uint64_t
read64(const void *src) {
#ifdef GOLOMB_LITTLE_ENDIAN
  uint64_t w;
  memcpy(&w, src, sizeof w);
  return w;
#else
  const uint8_t *p = (const uint8_t *)src;
  return ((uint64_t)(p[0]) << 0)
    | ((uint64_t)(p[1]) << 8)
    | ((uint64_t)(p[2]) << 16)
    | ((uint64_t)(p[3]) << 24)
    | ((uint64_t)(p[4]) << 32)
    | ((uint64_t)(p[5]) << 40)
    | ((uint64_t)(p[6]) << 48)
    | ((uint64_t)(p[7]) << 56);
#endif
}

#ifdef __GNUC__
#ifdef __SIZEOF_INT128__
typedef unsigned __int128 uint128_t;
#else
typedef unsigned uint128_t __attribute__((mode(TI)));
#endif
#endif

static inline uint64_t
reduce64(const uint64_t a, const uint64_t b) {
#ifdef __GNUC__
  return (uint64_t)(((uint128_t)a * (uint128_t)b) >> 64);
#elif
  uint64_t ahi = a >> 32;
  uint64_t alo = a & 0xffffffff;
  uint64_t bhi = b >> 32;
  uint64_t blo = b & 0xffffffff;

  uint64_t axbhi = ahi * bhi;
  uint64_t axbmid = ahi * blo;
  uint64_t bxamid = bhi * alo;
  uint64_t axblo = alo * blo;

  uint64_t c = (axbmid & 0xffffffff) + (bxamid & 0xffffffff) + (axblo >> 32);

  return axbhi + (axbmid >> 32) + (bxamid >> 32) + (c >> 32);
#endif
}

uint64_t
golomb_siphash(
  const uint8_t *data,
  size_t len,
  const uint8_t *key
) {
  uint64_t k0 = read64(key);
  uint64_t k1 = read64(key + 8);
  uint32_t blocks = len / 8;
  uint64_t v0 = 0x736f6d6570736575ull ^ k0;
  uint64_t v1 = 0x646f72616e646f6dull ^ k1;
  uint64_t v2 = 0x6c7967656e657261ull ^ k0;
  uint64_t v3 = 0x7465646279746573ull ^ k1;
  uint64_t f0 = ((uint64_t)blocks << 56);
  const uint64_t f1 = 0xff;

  for (uint32_t i = 0; i < blocks; i++) {
    uint64_t d = read64(data);
    data += 8;
    v3 ^= d;
    SIPROUND;
    SIPROUND;
    v0 ^= d;
  }

  switch (len & 7) {
    case 7:
      f0 |= ((uint64_t)data[6]) << 48;
    case 6:
      f0 |= ((uint64_t)data[5]) << 40;
    case 5:
      f0 |= ((uint64_t)data[4]) << 32;
    case 4:
      f0 |= ((uint64_t)data[3]) << 24;
    case 3:
      f0 |= ((uint64_t)data[2]) << 16;
    case 2:
      f0 |= ((uint64_t)data[1]) << 8;
    case 1:
      f0 |= ((uint64_t)data[0]);
      break;
    case 0:
      break;
  }

  v3 ^= f0;
  SIPROUND;
  SIPROUND;
  v0 ^= f0;
  v2 ^= f1;
  SIPROUND;
  SIPROUND;
  SIPROUND;
  SIPROUND;
  v0 ^= v1;
  v0 ^= v2;
  v0 ^= v3;

  return v0;
}

uint64_t
golomb_sipmod(
  const uint8_t *data,
  size_t len,
  const uint8_t *key,
  const uint64_t m
) {
  uint64_t v = golomb_siphash(data, len, key);
  return reduce64(v, m);
}
