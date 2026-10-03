# LiteSVM native addon for Windows x64 (litesvm@0.8.0)

The npm package `litesvm@0.8.0` (the last release built on `@solana/web3.js` 1.x)
ships native binaries only for Linux and macOS. `litesvm.win32-x64-msvc.node` here
is a local build of the same napi-rs crate, so the package also works on Windows.

`scripts/setup-litesvm-windows.mjs` runs as the root `postinstall` script. On
`win32`/`x64` only, it copies this file to
`<resolved litesvm>/dist/litesvm.win32-x64-msvc.node`. That's the first path the
package's napi-rs loader (`dist/internal.js`) tries on Windows with the official MSVC-built
Node. On Linux/macOS the script exits immediately, so the official binaries are used.
If a running node process has the addon loaded, the copy can fail. In that case,
close the process and run `node scripts/setup-litesvm-windows.mjs`.

## Provenance

- Source: https://github.com/LiteSVM/litesvm at commit
  `47f99a15dd36e7a728603868ce480ae3db087a05` ("Release node-litesvm v0.8.0"),
  crate `crates/node-litesvm` (`litesvm-node` 0.8.0, features `nodejs-internal`, `precompiles`)
- Target: `x86_64-pc-windows-gnu`, release profile, `-C target-feature=+crt-static`,
  plus `--features napi/dyn-symbols`
- Toolchain: Rust 1.99.0 stable (`stable-x86_64-pc-windows-gnu`), w64devkit GCC 16.2.0 (mingw-w64, msvcrt)
- OpenSSL: 3.5.5 from the `openssl-src` 300.5.5+3.5.5 sources, built static with `no-asm`.
  It's needed by `openssl` (secp256r1 precompile, via agave-precompiles).
- Despite the `-msvc` file name, it's a MinGW build. The name only matches what the loader
  looks for. It imports only Windows system DLLs (kernel32, ntdll, msvcrt, advapi32,
  bcrypt, bcryptprimitives, crypt32, user32, ws2_32). There's no libgcc/libstdc++/libnode
  dependency. N-API symbols are resolved at load time from `node.exe`.
- sha256 `476bef2af606a440668289b63684d01191f8889834ed215b896c95f0c0edf586`

## How it was built (Git Bash, no admin / no Visual Studio)

```bash
git clone https://github.com/LiteSVM/litesvm && cd litesvm
git checkout 47f99a15dd36e7a728603868ce480ae3db087a05

export PATH="/c/Users/AE/tools/w64devkit/bin:$PATH"     # gcc, ar, make (busybox-w32)

# 1) w64devkit GCC is built --disable-shared, so the unwinder is in libgcc.a and there is no
#    libgcc_eh.a. Rust's +crt-static asks for -lgcc_eh, so provide an empty archive:
mkdir -p ~/tools/mingw-shim && ar rc ~/tools/mingw-shim/libgcc_eh.a
export LIBRARY_PATH='C:/Users/AE/tools/mingw-shim'

# 2) napi's build.rs on windows-gnu panics unless it finds libnode.dll. Give it an empty stub DLL.
#    Nothing is imported from it, because dyn-symbols (below) loads N-API from node.exe at runtime.
echo 'int stub(void){return 0;}' > stub.c && gcc -shared -o ~/tools/mingw-shim/libnode.dll stub.c
export LIBNODE_PATH='C:\Users\AE\tools\mingw-shim'

# 3) OpenSSL (openssl/vendored -> openssl-src). Git for Windows' perl lacks a few core modules
#    that Configure needs. Tiny stand-ins for Locale::Maketext::Simple, ExtUtils::MakeMaker
#    (MM->maybe_command only) and Pod::Usage (pod2usage only) were placed in ~/tools/perl-shim.
export PERL5LIB=/c/Users/AE/tools/perl-shim MSYS2_ENV_CONV_EXCL=PERL5LIB
#    Perlasm breaks under native make -> msys perl argument quoting, so configure with no-asm.
#    Also, openssl-src's install step fails because busybox cp can't handle /C/... paths.
#    So run openssl-src's Configure once with "no-asm" appended
#    (OPENSSL_SRC_PERL=perl-noasm.cmd wrapper: `perl %* no-asm`), let it build, then install
#    from its build tree:
#      cd $CARGO_TARGET_DIR/x86_64-pc-windows-gnu/release/build/openssl-sys-*/out/openssl-build/build/src
#      make install_dev INSTALLTOP=C:/Users/AE/tools/openssl-3.5.5-mingw-static \
#           OPENSSLDIR=C:/Users/AE/tools/openssl-3.5.5-mingw-static/ssl \
#           libdir=C:/Users/AE/tools/openssl-3.5.5-mingw-static/lib
#    and link against that install:
export OPENSSL_NO_VENDOR=1 OPENSSL_STATIC=1 OPENSSL_DIR='C:/Users/AE/tools/openssl-3.5.5-mingw-static'

# 4) Build. napi is a default-features=false workspace dep. On windows-gnu we must enable
#    napi-sys "dyn-symbols", or the cdylib would need to link against libnode.dll.
export RUSTFLAGS="-C target-feature=+crt-static"
cargo build --release -p litesvm-node --target x86_64-pc-windows-gnu --features napi/dyn-symbols

cp target/x86_64-pc-windows-gnu/release/litesvm_node.dll litesvm.win32-x64-msvc.node
```

The full script used on this machine is `C:\Users\AE\tools\build-litesvm-node.sh`. The shims are
in `C:\Users\AE\tools\mingw-shim` and `C:\Users\AE\tools\perl-shim`.
