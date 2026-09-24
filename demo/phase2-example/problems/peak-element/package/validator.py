def validate(inp):
    n = inp.int(1, 200000)
    seen = set()
    for _ in range(n):
        v = inp.int(-10**9, 10**9)
        assert v not in seen, "values must be distinct"
        seen.add(v)
    inp.eof()
