"""The contest engine: every rule of the contest, and all of its state.

Nothing in this package knows about HTTP. The FastAPI layer in `api/` checks who
is calling and what they sent, then calls a function here.
"""
