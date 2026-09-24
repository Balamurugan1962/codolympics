import sys


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    vals = [int(x) for x in data[1 : 1 + n]]
    first = second = None
    for v in vals:
        if first is None or v > first:
            if first is not None and v != first:
                second = first
            first = v
        elif v != first and (second is None or v > second):
            second = v
    print(second if second is not None else "NONE")


main()
