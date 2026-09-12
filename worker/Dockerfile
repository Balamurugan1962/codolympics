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

# Add languages here. Keep the list tight: every toolchain is image size, and
# image size is contest-day deploy time.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
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
ARG PYPY_SHA256_amd64=2bcab031cef7a37fe1930b51f7091e78a191ae63f80eca00a265d3378c3a645b
ARG PYPY_SHA256_arm64=ed3b27a95257a8bb88707042e6bb5fe64569d47ef44bdc9842c730667637dfbd
RUN set -eux; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl ca-certificates; \
    # dpkg --print-architecture works under a plain `docker build`; the buildx
    # TARGETARCH arg is empty there, which would silently pick the wrong build.
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) slug="linux64";  sha="$PYPY_SHA256_amd64" ;; \
      arm64) slug="aarch64";  sha="$PYPY_SHA256_arm64" ;; \
      *) echo "no PyPy build for $arch" >&2; exit 1 ;; \
    esac; \
    tarball="pypy${PYPY_PYTHON}-v${PYPY_VERSION}-${slug}.tar.gz"; \
    curl -fsSL -o /tmp/pypy.tar.gz "https://downloads.python.org/pypy/${tarball}"; \
    echo "${sha}  /tmp/pypy.tar.gz" | sha256sum -c -; \
    mkdir -p /usr/local/pypy3; \
    tar -xzf /tmp/pypy.tar.gz -C /usr/local/pypy3 --strip-components=1; \
    rm /tmp/pypy.tar.gz; \
    ln -sf /usr/local/pypy3/bin/pypy3 /usr/local/bin/pypy3; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /var/lib/apt/lists/*; \
    /usr/local/bin/pypy3 -c "import sys; print('pypy', sys.version)"

# -cgroup-fd / systemd dbus is unavailable inside Docker Desktop, so the
# container must be started with --cgroupns=host --privileged.
EXPOSE 5050
ENTRYPOINT ["/opt/go-judge"]
