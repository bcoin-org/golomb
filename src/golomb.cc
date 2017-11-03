/**
 * golomb.cc
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License)
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <node.h>
#include <nan.h>

#include "siphash.h"

NAN_METHOD(sipmod) {
  if (info.Length() < 4)
    return Nan::ThrowError("sipmod() requires arguments.");

  v8::Local<v8::Object> buf = info[0].As<v8::Object>();

  if (!node::Buffer::HasInstance(buf))
    return Nan::ThrowTypeError("First argument must be a buffer.");

  v8::Local<v8::Object> kbuf = info[1].As<v8::Object>();

  if (!node::Buffer::HasInstance(kbuf))
    return Nan::ThrowTypeError("Second argument must be a buffer.");

  if (!info[2]->IsNumber())
    return Nan::ThrowTypeError("Third argument must be a number.");

  if (!info[3]->IsNumber())
    return Nan::ThrowTypeError("Fourth argument must be a number.");

  const uint8_t *data = (const uint8_t *)node::Buffer::Data(buf);
  size_t len = node::Buffer::Length(buf);

  const uint8_t *kdata = (const uint8_t *)node::Buffer::Data(kbuf);
  size_t klen = node::Buffer::Length(kbuf);

  const uint32_t nhi = info[2]->Uint32Value();
  const uint32_t nlo = info[3]->Uint32Value();

  if (klen < 16)
    return Nan::ThrowError("Bad key size for siphash.");

  uint64_t result = golomb_sipmod(data, len, kdata, nhi, nlo);

  v8::Local<v8::Array> ret = Nan::New<v8::Array>();
  ret->Set(0, Nan::New<v8::Int32>((int32_t)(result >> 32)));
  ret->Set(1, Nan::New<v8::Int32>((int32_t)(result & 0xffffffff)));

  info.GetReturnValue().Set(ret);
}

NAN_MODULE_INIT(init) {
  Nan::Export(target, "sipmod", sipmod);
}

NODE_MODULE(golomb, init)
