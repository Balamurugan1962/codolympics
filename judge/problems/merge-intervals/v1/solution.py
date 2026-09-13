import sys

def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    spans = []
    for i in range(n):
        spans.append((int(data[1 + 2 * i]), int(data[2 + 2 * i])))
    spans.sort()

    merged = []
    start, end = spans[0]
    for s, e in spans[1:]:
        if s <= end:
            end = max(end, e)
        else:
            merged.append((start, end))
            start, end = s, e
    merged.append((start, end))

    out = [str(len(merged))]
    out += [f"{s} {e}" for s, e in merged]
    sys.stdout.write("\n".join(out) + "\n")

main()
