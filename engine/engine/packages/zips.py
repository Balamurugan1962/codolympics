"""Reading and writing zip files, and the JSON files inside them."""

from __future__ import annotations

import io
import json
import re
import zipfile
from typing import Any

from engine.core import errors

NOISE = re.compile(r"(^|/)(__MACOSX/|\.DS_Store$|Thumbs\.db$)")


def read_zip(data: bytes) -> dict[str, bytes]:
    """Every real file in a zip, keyed by its path. Folders and OS clutter are dropped."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return {
                i.filename: z.read(i)
                for i in z.infolist()
                if not i.is_dir() and not NOISE.search(i.filename)
            }
    except (zipfile.BadZipFile, ValueError):
        raise errors.invalid("the upload is not a valid zip file") from None


def write_zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


def json_bytes(value: Any) -> bytes:
    """A JSON file as it is written into an export: indented, with a trailing newline."""
    return (json.dumps(value, indent=2) + "\n").encode()


def check_format(doc: dict[str, Any], newest: int) -> None:
    """Refuse a file written by a newer version of the exporter than this one understands."""
    if isinstance(doc.get("format"), int) and doc["format"] > newest:
        raise errors.invalid(f"that zip was made by a newer version (format {doc['format']})")


def subtree(files: dict[str, bytes], prefix: str) -> dict[str, bytes]:
    """The files under one folder of a zip, with the folder prefix removed."""
    return {name[len(prefix) :]: data for name, data in files.items() if name.startswith(prefix)}


def bundle_dirs(files: dict[str, bytes], root: str) -> list[str]:
    """Every `<root><id>/` folder in a bundle that holds a question.json."""
    dirs = set()
    for name in files:
        if name.startswith(root) and name.endswith("/question.json"):
            dirs.add(name[: name.rindex("/") + 1])
    return sorted(dirs)
