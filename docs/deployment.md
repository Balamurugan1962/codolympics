# Deploying the contest

The whole contest runs from **one MacBook Air (M2, 8 GB)** as five Docker containers
(`docker-compose.yml` in the repository root). This page is what to set, in what order,
and why. The numbers come from measurements on that machine, not from guesses.

No secret belongs in this file. Passwords and tokens live in the root `.env`, which git
ignores.

## What the machine is, and what that means

| Fact | Consequence |
|---|---|
| 4 fast cores + 4 slow cores, and macOS cannot pin work to the fast ones | Do not oversubscribe. Keep the number of busy threads at or below about 5. |
| No fan | Sustained load slows it down a little (measured about 10% after 3 minutes, then flat). Keep it cool. |
| 8 GB of RAM | Docker must not take most of it, or macOS starts swapping. Give Docker 5 GB. |
| Low Power Mode on battery | Measured 35–46% slower. Always plug in and turn it off. |

Measured with the same fixed CPU task (lower is faster):

| | Battery, Low Power Mode | Plugged in, Low Power Mode off |
|---|---|---|
| 1 core | 1.38 s | 0.89 s |
| 4 cores | 1.85 s | 0.99 s |
| 8 cores | 2.76 s | 1.89 s |

Inside Docker (5 CPUs), with the engine, website and database busy at the same time:

| Judge jobs at once | Time per job | Slower than judge alone |
|---|---|---|
| 3 | 0.75 s | +17% |
| 4 | 0.93 s | +52% |

So the judge runs **3 jobs at a time**, which leaves one fast core free for everything else.
Keeping the other services on their own CPUs gained only about 5% and could starve the
website in a busy moment, so they are left unpinned.

## Settings

### The Mac

- **Plugged in the whole time**, on a hard surface with air around it (not a lap or a bed).
- **System Settings → Battery → Low Power Mode → Never.**
- **Never sleep.** System Settings → Battery → Options → "Prevent automatic sleeping on
  power adapter when the display is off", or run `caffeinate -dimsu` in a terminal.
- **A fixed address.** Participants type it, so reserve one for the Mac in the router
  (a DHCP reservation), or set it by hand in System Settings → Network. This machine is on
  Wi-Fi. Ethernet is better if the hall has a cable.
- Firewall off, or allow Docker.

### Docker Desktop (Settings)

- **Resources → CPUs: 5. Memory: 5 GB.** The default is more than this, and on an 8 GB Mac
  that leaves macOS too little.
- **General → Start Docker Desktop when you sign in: on**, so a reboot brings it back.
- **Resource Saver: off**, or Docker can pause the containers when the machine looks idle.

### `.env` (repository root, never committed)

```
BETTER_AUTH_URL=http://<the Mac's fixed address>:3000   # what participants type, NOT localhost
JUDGE_CONCURRENCY=3
GO_JUDGE_CPUSET=0-3        # keep: pins the sandbox so timings stay comparable
```

Everything else in `.env` (passwords, tokens) stays as it is. `ADMIN_PASSWORD` must be at
least 8 characters, or the engine refuses to create the administrator.

### One fix to `docker-compose.yml` first

The compose file does not pass `JUDGE_CONCURRENCY` to the judge, so setting it in `.env`
does nothing until this is added under `judge-api` → `environment`:

```yaml
      JUDGE_CONCURRENCY: "${JUDGE_CONCURRENCY:-0}"
      JUDGE_QUEUE_LIMIT: "${JUDGE_QUEUE_LIMIT:-0}"
```

After starting, check the judge log says `concurrency=3`:

```
docker compose logs judge-api | grep "judge ready"
```

## Steps

### Well before the contest (allow an hour: the website image alone can take 25 minutes to build)

1. Make the compose and `.env` changes above.
2. Check there is room. The images are about 10 GB: `df -h /` should show more than 15 GB free.
3. `docker compose up -d --build`. This builds the worker image too, which now carries a
   precompiled `<bits/stdc++.h>` that makes C++ compiles several times cheaper.
4. Confirm all five containers are up: `docker compose ps`.
5. Load the real content through the admin pages (Settings → Setup, out and back in → Import a setup) and check
   it: publish, validate, and try a Phase 1 puzzle and a hack.

### Rehearsal (do it once, on the hall network if you can)

6. Sign in from **other machines** over the hall network and go through Phase 1 and Phase 2:
   answer, hack, and submit code in every language.
7. `docker compose exec -T judge-api python - < judge/scripts/warm_up.py` should end with
   `all languages ready`. It also fails loudly if any language is broken. It needs at least
   one ordinary published problem to borrow limits from, so run it after step 5; on an empty
   install it stops with "import one first".
8. Reset the contest afterwards (Settings → reset) and remove the test accounts.

### Contest morning

9. Plug in. Low Power Mode off. Nothing else heavy running on the Mac.
10. About 10 minutes before opening, run the warm-up script from step 7. The first compile
    of each language after a restart is the slowest, and this takes that cost before the
    first participant.
11. Start backups. Every 10 minutes, and copy the file off the Mac (a USB drive, or another
    computer):
    ```
    docker compose exec -T postgres pg_dump -U contest contest > backup-$(date +%H%M).sql
    ```

### During

- Admin → Monitor shows the judge, submissions and **Screen exits**.
- `docker stats --no-stream` (containers), `pmset -g therm` (heat), `pmset -g batt` (power).
- The pages poll every 3 seconds, or every second during an online auction.

## Known limits (measured on this Mac, plugged in)

- Up to about 200 people at once are comfortable. Beyond about 250 the engine is saturated.
  Your planning number is 60, which is well inside that.
- 40 people opening the site in the same second get the page in about 0.6 s.
- Judging bursts: 20 people submitting C++ in the same second all finish in about 11 s; 40
  Python in under 6 s. A burst of 40 hacks finishes in 3–4 s.
- **Time limits.** The same Java program measures about 550 ms alone and up to about 900 ms
  under a queue. So a run that hits the time limit is run once more, and a program that is
  really too slow still fails. Set limits at least **2× the slowest reference solution**, and
  put the nearest wrong approach (for example an n√n solution) in the Validate step so it is
  shown to fail.

## If something goes wrong

| Symptom | Do |
|---|---|
| Mac slows down, or the fan-less body is hot | Move it somewhere cooler and open the lid. Check `pmset -g therm`. |
| Submissions queue for long | `docker stats`. If the judge is at its limit, wait: jobs are not lost. Do not raise `JUDGE_CONCURRENCY` mid-contest. |
| A language stops working | Run the warm-up script. It names the language that fails. |
| A container stopped | `docker compose up -d`. Data lives in Docker volumes and is kept. |
| Site unreachable from other machines | Check the Mac's address has not changed, and that `BETTER_AUTH_URL` matches it. |
| The Mac restarted | Docker Desktop starts by itself if the setting above is on; then `docker compose up -d`. |
| Lost data | Restore the newest `backup-*.sql` into an empty database. Do this only if the volume is really gone. |

## Why not a second machine for the judge?

A Windows laptop with a proper CPU exists. Splitting the judge onto it was considered and
rejected: it adds a machine and a network link that can fail, needs new code to copy the
problem files across, and the sandbox is unproven there. The load at 45–60 people does not
need it. Reconsider only if a rehearsal, after the settings above, still shows uneven timing
(correct code failing on time, or C++ submissions taking over about 15 seconds).

## Sources for the machine facts

- M2 MacBook Air sustained performance: <https://wccftech.com/m2-macbook-air-throttling-problem-under-sustained-workload/>
- Docker Desktop on Apple silicon, recommended sizing: <https://oneuptime.com/blog/post/2026-01-16-docker-mac-apple-silicon/view>
- Low Power Mode and CPU performance: <https://eclecticlight.co/2025/01/08/power-modes-and-apple-silicon-cpus/>
