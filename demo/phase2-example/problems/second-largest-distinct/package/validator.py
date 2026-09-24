def validate(inp):
    n = inp.int(1, 100000)
    inp.ints(n, -10**9, 10**9)
    inp.eof()
