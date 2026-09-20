"""Where testcase bytes come from (US-J5-05).

The interface is deliberately tiny, read a key and list a prefix, so that
swapping local disk for S3 later touches this file and nothing else. Judging
logic never opens a path.

Keys are POSIX-style relative paths, e.g. "hard-03/v3/tests/00012.in".
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from pathlib import Path


class Storage(ABC):
    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def read(self, key: str) -> bytes: ...

    @abstractmethod
    def list(self, prefix: str) -> list[str]:
        """Keys directly under `prefix`, sorted. Not recursive."""

    @abstractmethod
    def size(self, key: str) -> int: ...

    @abstractmethod
    def modified_at(self, key: str) -> float:
        """Unix timestamp."""

    @abstractmethod
    def resolve_symlink(self, key: str) -> str | None:
        """Name a pointer points at, or None. Used to read `current`.

        A local filesystem has symlinks; an object store would keep the
        pointer as a small object instead. Callers treat None as "no
        versioned layout".
        """

    def read_text(self, key: str) -> str:
        """Testcases are UTF-8 text; this service only judges stdin/stdout problems."""
        return self.read(key).decode("utf-8")


class LocalStorage(Storage):
    """Reads straight off disk: no network round trip, no cache to invalidate."""

    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        # Resolving and then checking containment stops "../" in a problem_id
        # from reaching outside the problem root, even though the API also
        # constrains the id by pattern.
        candidate = (self.root / key).resolve()
        if candidate != self.root and self.root not in candidate.parents:
            raise ValueError(f"key escapes the problem root: {key}")
        return candidate

    def exists(self, key: str) -> bool:
        try:
            return self._path(key).exists()
        except ValueError:
            return False

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def list(self, prefix: str) -> list[str]:
        directory = self._path(prefix)
        if not directory.is_dir():
            return []
        prefix = prefix.rstrip("/")
        # Sorted by name so testcase ordering is deterministic (US-J1-06).
        return sorted(f"{prefix}/{entry.name}" for entry in directory.iterdir())

    def size(self, key: str) -> int:
        return self._path(key).stat().st_size

    def modified_at(self, key: str) -> float:
        return self._path(key).stat().st_mtime

    def resolve_symlink(self, key: str) -> str | None:
        # Deliberately not _path(): that resolves the whole path, which follows
        # the symlink and would leave nothing to read.
        path = self.root / key
        parent = path.parent.resolve()
        if parent != self.root and self.root not in parent.parents:
            return None
        if not path.is_symlink():
            return None
        return os.path.basename(os.readlink(path))
