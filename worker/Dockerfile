# Sandbox worker: go-judge (the execution engine) + the compilers/runtimes
# contestants are allowed to use.
#
# The base image is Debian 13 with apt, and its sandbox binds /usr read-only
# into every box, so anything installed here is automatically visible inside
# the sandbox. /opt/mount.yaml already accounts for java/node/ghc/mono quirks.
#
# IMPORTANT: /opt is NOT one of the mounted paths. Anything a submission has to
# execute must live under /usr, /bin, /lib or /lib64, or it is invisible inside
# the sandbox even though it is present in the image.
FROM criyle/go-judge:v1.12.3

# apt over HTTPS. Campus networks tend to tamper with plain HTTP (a captive
# portal or transparent proxy answers instead of the mirror, and apt reports
# "Clearsigned file isn't valid" or a hash mismatch). The base image has no
# CA certificates, so they come from the Python image the judge is built on,
# which is pulled anyway; ca-certificates proper is installed right after.
#
# apt is told where the bundle is: OpenSSL finds roots through the hashed
# links in /etc/ssl/certs that update-ca-certificates writes, and without
# ca-certificates installed there are none, so the bundle alone verifies
# nothing ("certificate verify failed" on every mirror).
COPY --from=python:3.12-slim-bookworm /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && echo 'Acquire::https::CaInfo "/etc/ssl/certs/ca-certificates.crt";' > /etc/apt/apt.conf.d/99-ca-bundle

# Add languages here. Keep the list tight: every toolchain is image size, and
# image size is contest-day deploy time.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      gcc g++ \
      python3 \
      openjdk-21-jdk-headless \
      nodejs \
    && rm -rf /var/lib/apt/lists/*

# PyPy is not packaged in Debian trixie, so it comes from the official portable
# tarball. It is the escape hatch for Python-only contestants: under exclusive
# question ownership, an owner who cannot fit the time limit loses the question
# outright and nobody else can attempt it.
#
# Installed under /usr/local so the sandbox's /usr bind mount picks it up, and
# /usr/local/bin is already on the sandbox PATH.
ARG PYPY_VERSION=7.3.23
ARG PYPY_PYTHON=3.11
# Where the tarball comes from: the official site by default, or a local mirror on a network that blocks it.
ARG PYPY_BASE_URL=https://downloads.python.org/pypy
ARG PYPY_SHA256_amd64=2bcab031cef7a37fe1930b51f7091e78a191ae63f80eca00a265d3378c3a645b
ARG PYPY_SHA256_arm64=ed3b27a95257a8bb88707042e6bb5fe64569d47ef44bdc9842c730667637dfbd
RUN set -eux; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl; \
    # dpkg --print-architecture works under a plain `docker build`; the buildx
    # TARGETARCH arg is empty there, which would silently pick the wrong build.
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) slug="linux64";  sha="$PYPY_SHA256_amd64" ;; \
      arm64) slug="aarch64";  sha="$PYPY_SHA256_arm64" ;; \
      *) echo "no PyPy build for $arch" >&2; exit 1 ;; \
    esac; \
    tarball="pypy${PYPY_PYTHON}-v${PYPY_VERSION}-${slug}.tar.gz"; \
    curl -fsSL -o /tmp/pypy.tar.gz "${PYPY_BASE_URL}/${tarball}"; \
    echo "${sha}  /tmp/pypy.tar.gz" | sha256sum -c -; \
    mkdir -p /usr/local/pypy3; \
    tar -xzf /tmp/pypy.tar.gz -C /usr/local/pypy3 --strip-components=1; \
    rm /tmp/pypy.tar.gz; \
    ln -sf /usr/local/pypy3/bin/pypy3 /usr/local/bin/pypy3; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /var/lib/apt/lists/*; \
    /usr/local/bin/pypy3 -c "import sys; print('pypy', sys.version)"

# A precompiled <bits/stdc++.h>. Most C++ solutions start with that one include,
# and reading it is nearly all of what a compile costs: about 2 s and a lot of
# memory bandwidth for one compile, and with several going at once they slow each
# other down far more than proportionally (7 at once took 25-45 s each; with the
# header precompiled, 4 at once take under 1 s each). Compiling it once here makes
# every submission's compile several times cheaper and, more to the point, keeps
# a burst of submissions from timing out.
#
# It must be built with the same flags the judge compiles with, or GCC ignores it
# (silently: the compile just gets slow again). Those flags are cpp's
# compile_args in judge/app/core/languages.py, and a judge test keeps the two in
# step. The last line fails the build if the header would not be used.
RUN set -eux; \
    hdr="$(find /usr/include -name stdc++.h -path '*bits*' | head -1)"; \
    test -n "$hdr"; \
    mkdir -p "$hdr.gch"; \
    g++ -O2 -std=gnu++20 -x c++-header "$hdr" -o "$hdr.gch/O2-gnu++20"; \
    printf '#include <bits/stdc++.h>\nint main(){}\n' > /tmp/pch-check.cpp; \
    g++ -O2 -std=gnu++20 -H -c /tmp/pch-check.cpp -o /tmp/pch-check.o 2>&1 | grep -q '^!'; \
    rm -f /tmp/pch-check.cpp /tmp/pch-check.o

# -cgroup-fd / systemd dbus is unavailable inside Docker Desktop, so the
# container must be started with --cgroupns=host --privileged.
EXPOSE 5050
ENTRYPOINT ["/opt/go-judge"]
