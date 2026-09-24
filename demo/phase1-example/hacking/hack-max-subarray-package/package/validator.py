def validate(inp):
    n = inp.int(1, 1000)
    for _ in range(n):
        inp.int(-1000, 1000)
    inp.eof()
