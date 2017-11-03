{
  "variables": {
    "golomb_byteorder%":
      "<!(python -c 'from __future__ import print_function; import sys; print(sys.byteorder)')",
  },
  "targets": [{
    "target_name": "golomb",
    "sources": [
      "./src/siphash.cc",
      "./src/golomb.cc"
    ],
    "cflags": [
      "-Wall",
      "-Wno-implicit-fallthrough",
      "-Wno-maybe-uninitialized",
      "-Wno-uninitialized",
      "-Wno-unused-function",
      "-Wextra",
      "-O3"
    ],
    "cflags_c": [
      "-std=c99"
    ],
    "cflags_cc+": [
      "-std=c++0x"
    ],
    "include_dirs": [
      "<!(node -e \"require('nan')\")"
    ],
    "conditions": [
      ["golomb_byteorder=='little'", {
        "defines": [
          "GOLOMB_LITTLE_ENDIAN"
        ]
      }, {
        "defines": [
          "GOLOMB_BIG_ENDIAN"
        ]
      }]
    ]
  }]
}
