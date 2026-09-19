"""Passwords and ids in exactly the format Better Auth writes.

Matching Better Auth byte for byte is what lets an account the engine creates
sign in through the web app, which verifies passwords itself.
"""

from __future__ import annotations

import hashlib
import secrets
import string
import unicodedata


def hash_password(password: str) -> str:
    """`salt:key` in hex: scrypt N=16384 r=16 p=1 with a 64-byte key.

    Exactly what Better Auth writes and verifies.
    """
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(
        unicodedata.normalize("NFKC", password).encode(),
        salt=salt.encode(),
        n=16384,
        r=16,
        p=1,
        dklen=64,
        maxmem=128 * 16384 * 16 * 2,
    )
    return f"{salt}:{key.hex()}"


def generate_id() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(32))
