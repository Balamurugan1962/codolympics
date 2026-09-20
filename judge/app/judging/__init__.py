"""Turning a submission into a result.

`judge` runs a program against stored testcases, `hack` runs it against a
supplied input, `validation` proves a problem before it is auctioned and
`answers` scores a list of entries. `tasks` wraps each of those as a unit of
work the job queue can run without knowing what it is.
"""
