"""Alembic runs migrations against DATABASE_URL, the same database the engine uses."""
from alembic import context

from engine.core.db import pool

with pool.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
