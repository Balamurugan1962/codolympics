import sys

data = sys.stdin.read().split()
n, x = int(data[0]), int(data[1])
a = [int(v) for v in data[2:2 + n]]
print(sum(1 for v in a if v == x))
