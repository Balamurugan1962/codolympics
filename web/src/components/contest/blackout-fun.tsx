"use client";

/**
 * Something to do while blacked out: a joke that changes every few seconds and a small
 * keyboard game picked at random. Nothing here touches the contest, and every game is drawn
 * on one canvas with no assets, so the hall's LAN-only machines need nothing to play.
 *
 * Typing must never reach the editor underneath, so the game takes focus the moment the
 * overlay appears and swallows the keys it uses.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const W = 360;
const H = 200;
const INK = "#e8ecf7";
const PANEL = "#11172b";
const ACCENT = "#7c83ff";

type Status = "ready" | "playing" | "over";
type Instance = {
  key(code: string): void;
  step(dtMs: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  score(): number;
  status(): Status;
};
type Game = { title: string; hint: string; create(): Instance };

const rand = (n: number) => Math.floor(Math.random() * n);
const isJump = (code: string) => code === "Space" || code === "ArrowUp" || code === "KeyW";

function say(ctx: CanvasRenderingContext2D, lines: string[], y = H / 2) {
  ctx.fillStyle = "rgba(9,12,24,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "600 16px system-ui, sans-serif" : "13px system-ui, sans-serif";
    ctx.fillText(line, W / 2, y + i * 22 - 8);
  });
}

function scoreText(ctx: CanvasRenderingContext2D, points: number) {
  ctx.fillStyle = INK;
  ctx.font = "600 13px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText(String(points), W - 10, 20);
}

function snake(): Instance {
  const cols = 18;
  const rows = 10;
  const cell = 20;
  let body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  let dir = { x: 1, y: 0 };
  let queued = { x: 1, y: 0 };
  let food = { x: 12, y: 5 };
  let acc = 0;
  let points = 0;
  let state: Status = "ready";
  const place = () => {
    for (;;) {
      const p = { x: rand(cols), y: rand(rows) };
      if (!body.some((b) => b.x === p.x && b.y === p.y)) { food = p; return; }
    }
  };
  const turn = (x: number, y: number) => {
    if (state === "ready") state = "playing";
    if (x !== -dir.x || y !== -dir.y) queued = { x, y };
  };
  return {
    key(code) {
      if (code === "ArrowUp" || code === "KeyW") turn(0, -1);
      else if (code === "ArrowDown" || code === "KeyS") turn(0, 1);
      else if (code === "ArrowLeft" || code === "KeyA") turn(-1, 0);
      else if (code === "ArrowRight" || code === "KeyD") turn(1, 0);
    },
    step(dt) {
      if (state !== "playing") return;
      acc += dt;
      while (acc >= 110 && state === "playing") {
        acc -= 110;
        dir = queued;
        const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || body.some((b) => b.x === head.x && b.y === head.y)) {
          state = "over";
          return;
        }
        body.unshift(head);
        if (head.x === food.x && head.y === food.y) { points += 1; place(); } else body.pop();
      }
    },
    draw(ctx) {
      ctx.fillStyle = PANEL;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff6b81";
      ctx.beginPath();
      ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      body.forEach((b, i) => {
        ctx.fillStyle = i === 0 ? "#7cf29c" : "#3fbf6b";
        ctx.fillRect(b.x * cell + 1, b.y * cell + 1, cell - 2, cell - 2);
      });
      scoreText(ctx, points);
      if (state === "ready") say(ctx, ["Snake", "Arrow keys or WASD to start"]);
      if (state === "over") say(ctx, ["Game over", `${points} eaten. Space to try again`]);
    },
    score: () => points,
    status: () => state,
  };
}

function dino(): Instance {
  const ground = 160;
  let lift = 0;
  let vy = 0;
  let speed = 0.24;
  let dist = 0;
  let next = 800;
  let state: Status = "ready";
  const cacti: { x: number; w: number; h: number }[] = [];
  return {
    key(code) {
      if (!isJump(code)) return;
      if (state === "ready") state = "playing";
      if (lift === 0) vy = 0.62;
    },
    step(dt) {
      if (state !== "playing") return;
      vy -= 0.0022 * dt;
      lift = Math.max(0, lift + vy * dt);
      if (lift === 0) vy = 0;
      speed += 0.000012 * dt;
      dist += speed * dt;
      next -= dt;
      if (next <= 0) {
        cacti.push({ x: W + 10, w: 12 + rand(12), h: 20 + rand(24) });
        next = (650 + rand(750)) * (0.24 / speed);
      }
      for (const c of cacti) c.x -= speed * dt;
      while (cacti.length && cacti[0].x + cacti[0].w < 0) cacti.shift();
      const top = ground - lift - 26;
      for (const c of cacti) {
        if (c.x < 62 && c.x + c.w > 40 && top + 26 > ground - c.h) state = "over";
      }
    },
    draw(ctx) {
      ctx.fillStyle = PANEL;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#3a4270";
      ctx.beginPath();
      ctx.moveTo(0, ground + 0.5);
      ctx.lineTo(W, ground + 0.5);
      ctx.stroke();
      ctx.fillStyle = "#3fbf6b";
      for (const c of cacti) ctx.fillRect(c.x, ground - c.h, c.w, c.h);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(40, ground - lift - 26, 22, 26);
      ctx.fillStyle = INK;
      ctx.fillRect(54, ground - lift - 22, 4, 4);
      scoreText(ctx, Math.floor(dist / 10));
      if (state === "ready") say(ctx, ["Dino run", "Space or ↑ to jump over the cacti"]);
      if (state === "over") say(ctx, ["Tripped", `${Math.floor(dist / 10)} m. Space to run again`]);
    },
    score: () => Math.floor(dist / 10),
    status: () => state,
  };
}

function flappy(): Instance {
  const pipeW = 38;
  const gap = 84;
  const bx = 80;
  let y = H / 2;
  let vy = 0;
  let points = 0;
  let spawn = 0;
  let state: Status = "ready";
  const pipes: { x: number; gapY: number; passed: boolean }[] = [];
  return {
    key(code) {
      if (!isJump(code)) return;
      if (state === "ready") state = "playing";
      vy = -0.34;
    },
    step(dt) {
      if (state !== "playing") return;
      vy += 0.0012 * dt;
      y += vy * dt;
      spawn -= dt;
      if (spawn <= 0) { pipes.push({ x: W, gapY: 30 + rand(H - gap - 60), passed: false }); spawn = 1500; }
      for (const p of pipes) {
        p.x -= 0.13 * dt;
        if (!p.passed && p.x + pipeW < bx) { p.passed = true; points += 1; }
        const overlaps = p.x < bx + 9 && p.x + pipeW > bx - 9;
        if (overlaps && (y - 9 < p.gapY || y + 9 > p.gapY + gap)) state = "over";
      }
      while (pipes.length && pipes[0].x + pipeW < 0) pipes.shift();
      if (y < 0 || y > H) state = "over";
    },
    draw(ctx) {
      ctx.fillStyle = PANEL;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3fbf6b";
      for (const p of pipes) {
        ctx.fillRect(p.x, 0, pipeW, p.gapY);
        ctx.fillRect(p.x, p.gapY + gap, pipeW, H - p.gapY - gap);
      }
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(bx, y, 9, 0, Math.PI * 2);
      ctx.fill();
      scoreText(ctx, points);
      if (state === "ready") say(ctx, ["Flappy", "Space or ↑ to flap"]);
      if (state === "over") say(ctx, ["Splat", `${points} pipes. Space to fly again`]);
    },
    score: () => points,
    status: () => state,
  };
}

const GAMES: Game[] = [
  { title: "Snake", hint: "Arrow keys or WASD", create: snake },
  { title: "Dino run", hint: "Space or ↑ to jump", create: dino },
  { title: "Flappy", hint: "Space or ↑ to flap", create: flappy },
];

const JOKES = [
  "The server is laughing. Quietly.",
  "Blackouts build character. Also latency.",
  "Think about the case n = 1. It is always n = 1.",
  "Rubber duck mode: explain your solution to the ceiling.",
  "It is not a bug, it is a feature request from your opponent.",
  "Someone spent real coins to see you sit here. Wear it with pride.",
  "Plot twist: the off-by-one was in your heart all along.",
  "Somewhere a segfault is very proud of you.",
  "Take a sip of water. Coins cannot buy that.",
  "Your code is fine. Your code is waiting. Your code is judging you back.",
  "Pro tip: the answer is almost never “just sort it”. Except when it is.",
  "Have you tried turning your algorithm off and on again?",
  "This will pass in O(seconds).",
  "If it works on the sample, it will fail on test 47. Use this time to make peace with that.",
];

function Joke() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    setLine(rand(JOKES.length));
    const t = setInterval(() => setLine((l) => (l + 1 + rand(JOKES.length - 1)) % JOKES.length), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <p key={line} className="animate-fade-in mt-5 min-h-10 max-w-md text-[14px] leading-snug text-white/85 italic">
      {JOKES[line]}
    </p>
  );
}

function readBest(title: string): number {
  try { return Number(localStorage.getItem(`blackout-best:${title}`)) || 0; } catch { return 0; }
}

function writeBest(title: string, value: number) {
  try { localStorage.setItem(`blackout-best:${title}`, String(value)); } catch { /* private window: keep it in memory only */ }
}

function Arcade() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<Instance | null>(null);
  const [pick, setPick] = useState(0);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(0);
  const game = GAMES[pick];

  // Pick a game after mount: the overlay can be server-rendered, and a random pick would not match.
  useEffect(() => { setPick(rand(GAMES.length)); }, []);

  // Take the keyboard from whatever was being typed into.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    box.current?.focus();
  }, []);

  useEffect(() => {
    setBest(readBest(game.title));
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const instance = game.create();
    live.current = instance;
    let last = performance.now();
    let raf = 0;
    let reported = false;
    const frame = (now: number) => {
      instance.step(Math.min(50, now - last));
      last = now;
      instance.draw(ctx);
      if (instance.status() === "over" && !reported) {
        reported = true;
        if (instance.score() > readBest(game.title)) { writeBest(game.title, instance.score()); setBest(instance.score()); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, round]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const used = isJump(e.code) || /^(Arrow|Key[WASD]|Enter)/.test(e.code);
    if (!used) return;
    e.preventDefault();
    e.stopPropagation();
    if (live.current?.status() === "over" && (e.code === "Space" || e.code === "Enter")) setRound((r) => r + 1);
    else live.current?.key(e.code);
  }, []);

  const another = () => {
    setPick((p) => (p + 1 + rand(GAMES.length - 1)) % GAMES.length);
    box.current?.focus();
  };

  return (
    <div className="mt-6 flex flex-col items-center">
      <div
        ref={box}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`${game.title}. ${game.hint}`}
        className="overflow-hidden rounded-lg border border-white/15 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
      >
        <canvas ref={canvas} width={W} height={H} className="block max-w-full" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-[12px] text-white/55">
        <span>{game.title} · {game.hint}</span>
        <span className="tabular-nums">best {best}</span>
        <button type="button" onClick={another} className="rounded-full border border-white/20 px-2.5 py-0.5 hover:bg-white/10">
          Another game
        </button>
      </div>
    </div>
  );
}

export function BlackoutFun() {
  return (
    <>
      <Joke />
      <Arcade />
    </>
  );
}
