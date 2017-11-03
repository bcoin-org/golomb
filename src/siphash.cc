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
  const uint32_t nhi,
  const uint32_t nlo
) {
  uint64_t v = golomb_siphash(data, len, key);
  uint64_t vhi = v >> 32;
  uint64_t vlo = v & 0xffffffff;

  uint64_t vnphi = vhi * nhi;
  uint64_t vnpmid = vhi * nlo;
  uint64_t npvmid = nhi * vlo;
  uint64_t vnplo = vlo * nlo;

  uint64_t c = (vnpmid & 0xffffffff) + (npvmid & 0xffffffff) + (vnplo >> 32);

  return vnphi + (vnpmid >> 32) + (npvmid >> 32) + (c >> 32);
}
