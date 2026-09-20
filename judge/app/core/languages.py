"""What each language needs to compile and run inside the sandbox.

Adding a language is one entry here plus its toolchain in worker/Dockerfile
(US-J6-05). Nothing in the judging logic knows any language by name.

Compiled languages produce an artefact that go-judge caches, so we compile
once and reuse it for every testcase. Interpreted languages have no compile
step -- their "artefact" is the source file itself, uploaded once.
"""
from __future__ import annotations

from dataclasses import dataclass, field

BIN = "/usr/bin"
LOCAL_BIN = "/usr/local/bin"

# The sandbox mounts /usr read-only, so anything installed in the worker image
# under /usr is visible here. /usr/local/bin comes first so pypy3 resolves.
SANDBOX_ENV = [
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "HOME=/w",
    "LANG=C.UTF-8",
]


@dataclass(frozen=True)
class Language:
    key: str
    name: str
    source_name: str                 # filename the source gets inside the sandbox
    run_args: list[str]              # command used for every testcase
    compile_args: list[str] | None = None
    artefacts: list[str] = field(default_factory=list)   # cached after compiling
    env: list[str] = field(default_factory=lambda: list(SANDBOX_ENV))
    # Compilers need far more headroom than contestant code. These bound the
    # compile step only and never the runs.
    compile_time_limit_ms: int = 15_000
    compile_memory_mb: int = 512

    @property
    def compiled(self) -> bool:
        return self.compile_args is not None


_ALL = [
    Language(
        key="c",
        name="C (GCC 14)",
        source_name="main.c",
        compile_args=[f"{BIN}/gcc", "-O2", "-w", "-std=gnu17", "-o", "main", "main.c", "-lm"],
        artefacts=["main"],
        run_args=["main"],
    ),
    Language(
        key="cpp",
        name="C++ (GCC 14)",
        source_name="main.cpp",
        compile_args=[f"{BIN}/g++", "-O2", "-w", "-std=gnu++20", "-o", "main", "main.cpp"],
        artefacts=["main"],
        run_args=["main"],
    ),
    Language(
        key="python",
        name="Python 3.13",
        source_name="main.py",
        run_args=[f"{BIN}/python3", "main.py"],
    ),
    Language(
        key="pypy",
        name="PyPy 3.11 (7.3.23)",
        source_name="main.py",
        # Roughly 19x faster than CPython on tight loops. It exists because a
        # Python-only owner who cannot fit the time limit loses the question
        # outright -- under exclusive ownership nobody else can attempt it.
        run_args=[f"{LOCAL_BIN}/pypy3", "main.py"],
    ),
    Language(
        key="java",
        name="Java 21",
        source_name="Main.java",
        # Bundle every .class into a jar. Caching Main.class alone silently
        # breaks any submission using inner or anonymous classes.
        compile_args=[
            "/bin/sh", "-c",
            f"{BIN}/javac -encoding UTF-8 Main.java && {BIN}/jar cf app.jar *.class",
        ],
        artefacts=["app.jar"],
        run_args=[f"{BIN}/java", "-XX:+UseSerialGC", "-Xss64m", "-cp", "app.jar", "Main"],
        compile_time_limit_ms=25_000,
        compile_memory_mb=1_024,
    ),
    Language(
        key="javascript",
        name="JavaScript (Node 20)",
        source_name="main.js",
        run_args=[f"{BIN}/node", "main.js"],
    ),
]

LANGUAGES: dict[str, Language] = {lang.key: lang for lang in _ALL}


def get(key: str) -> Language | None:
    """The language, or None if we do not offer it. Callers raise the 400."""
    return LANGUAGES.get(key)


def keys() -> list[str]:
    return sorted(LANGUAGES)
