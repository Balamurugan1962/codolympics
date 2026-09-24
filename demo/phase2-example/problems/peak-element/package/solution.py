import sys


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = [int(x) for x in data[1 : 1 + n]]
    for i in range(n - 1):
        if a[i] > a[i + 1]:
            print(i)
            return
    print(n - 1)


main()
