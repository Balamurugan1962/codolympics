import sys

data = sys.stdin.read().split()
n = int(data[0])
a = [int(x) for x in data[1:1 + n]]

best = a[0]
current = a[0]
for value in a[1:]:
    current = max(value, current + value)
    best = max(best, current)

print(best)
