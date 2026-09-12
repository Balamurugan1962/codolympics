# Sandbox worker: go-judge (the execution engine) + the compilers/runtimes
# contestants are allowed to use.
#
# The base image is Debian 13 with apt, and its sandbox binds /usr read-only
# into every box, so anything installed here is automatically visible inside
# the sandbox. /opt/mount.yaml already accounts for java/node/ghc/mono quirks.
FROM criyle/go-judge:v1.12.3

# Add languages here. Keep the list tight: every toolchain is image size, and
# image size is contest-day deploy time.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gcc g++ \
      python3 \
      openjdk-21-jdk-headless \
      nodejs \
    && rm -rf /var/lib/apt/lists/*

# -cgroup-fd / systemd dbus is unavailable inside Docker Desktop, so the
# container must be started with --cgroupns=host --privileged.
EXPOSE 5050
ENTRYPOINT ["/opt/go-judge"]
