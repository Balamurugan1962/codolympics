import sys

def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    best = 0                      # wrong: an all-negative block can never beat 0
    here = 0
    for i in range(1, n + 1):
        here = max(0, here + int(data[i]))
        best = max(best, here)
    print(best)

main()
