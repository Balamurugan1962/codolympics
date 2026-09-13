import sys

def main():
    data = sys.stdin.buffer.read().split()
    n, target = int(data[0]), int(data[1])
    seen = {}
    for i in range(n):
        value = int(data[2 + i])
        need = target - value
        if need in seen:
            print(seen[need], i)
            return
        seen.setdefault(value, i)

main()
