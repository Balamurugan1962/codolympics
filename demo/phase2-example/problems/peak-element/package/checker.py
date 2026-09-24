def check(inp, out, ans):
    n = inp.int()
    a = inp.ints(n)
    idx = out.int(0, n - 1)
    out.eof()
    left = a[idx - 1] if idx > 0 else float("-inf")
    right = a[idx + 1] if idx < n - 1 else float("-inf")
    if not (a[idx] > left and a[idx] > right):
        return False, f"index {idx} (value {a[idx]}) is not a peak"
    return True
