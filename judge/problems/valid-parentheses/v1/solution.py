import sys

PAIRS = {")": "(", "]": "[", "}": "{"}

def main():
    s = sys.stdin.readline().strip()
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        else:
            if not stack or stack[-1] != PAIRS.get(ch):
                print("NO")
                return
            stack.pop()
    print("YES" if not stack else "NO")

main()
