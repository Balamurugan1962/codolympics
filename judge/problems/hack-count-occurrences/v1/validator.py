def validate(inp):
    n = inp.int(1, 1000)
    inp.int(-1000, 1000)
    previous = -10**9
    for _ in range(n):
        value = inp.int(-1000, 1000)
        assert value >= previous, "the array must be sorted non-decreasing"
        previous = value
    inp.eof()
