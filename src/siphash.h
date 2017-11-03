#ifndef _GOLOMB_SIPHASH_H
#define _GOLOMB_SIPHASH_H

#include <stdint.h>
#include <stdlib.h>

uint64_t
golomb_siphash(const uint8_t *data, size_t len, const uint8_t *key);

uint64_t
golomb_sipmod(
  const uint8_t *data,
  size_t len,
  const uint8_t *key,
  const uint64_t m
);

#endif
