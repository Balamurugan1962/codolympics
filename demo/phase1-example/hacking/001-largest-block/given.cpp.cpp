#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    long long best = 0;           // wrong: an all-negative block can never beat 0
    long long here = 0;
    for (int i = 0; i < n; i++) {
        long long a;
        cin >> a;
        here = max(0LL, here + a);
        best = max(best, here);
    }
    cout << best << "\n";
}
