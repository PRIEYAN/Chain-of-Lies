import { useRef, useState, useEffect, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GamePhase = "start" | "playing" | "dead" | "won";

interface Player {
    x: number;
    y: number;
    w: number;
    h: number;
    vy: number;
    grounded: boolean;
    energy: number;
    maxEnergy: number;
    gas: number;
    invincible: number;
    particles: Particle[];
}

interface Obstacle {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Coin {
    x: number;
    y: number;
    r: number;
    gold: boolean;
    collected: boolean;
    pulse: number;
}

interface Gate {
    x: number;
    y: number;
    w: number;
    h: number;
    cost: number;
    open: boolean;
    openTimer: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    r: number;
}

interface GameState {
    phase: GamePhase;
    player: Player;
    obstacles: Obstacle[];
    coins: Coin[];
    gates: Gate[];
    particles: Particle[];
    score: number;
    coinsCollected: number;
    speed: number;
    frame: number;
    groundY: number;
    gridOffset: number;
    spawnTimers: { obstacle: number; coin: number; gate: number };
}

const W = 400;
const H = 600;
const GROUND = H - 60;
const GRAVITY = 0.48;
const JUMP_V = -14;
const PLAYER_X = 70;
const TIME_LIMIT = 30 * 60;

function makePlayer(): Player {
    return {
        x: PLAYER_X,
        y: GROUND - 40,
        w: 36,
        h: 36,
        vy: 0,
        grounded: true,
        energy: 100,
        maxEnergy: 100,
        gas: 0,
        invincible: 0,
        particles: [],
    };
}

function makeState(): GameState {
    return {
        phase: "start",
        player: makePlayer(),
        obstacles: [],
        coins: [],
        gates: [],
        particles: [],
        score: 0,
        coinsCollected: 0,
        speed: 2.2,
        frame: 0,
        groundY: GROUND,
        gridOffset: 0,
        spawnTimers: { obstacle: 130, coin: 45, gate: 550 },
    };
}

function spawnParticles(
    arr: Particle[],
    x: number,
    y: number,
    color: string,
    count = 8
) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 2.5;
        arr.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 40 + Math.random() * 20,
            maxLife: 60,
            color,
            r: 2 + Math.random() * 3,
        });
    }
}

function rectsOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(
    cx: number,
    cy: number,
    r: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
}

export default function GasFeeRunnerPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<GameState>(makeState());
    const rafRef = useRef<number>(0);
    const [phase, setPhase] = useState<GamePhase>("start");
    const [hud, setHud] = useState({ score: 0, gas: 0, energy: 100, coins: 0 });

    const TASK_ID = "task3";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();

    useEffect(() => {
        if (isOpen) {
            stateRef.current = makeState();
            setPhase("start");
        }
    }, [isOpen]);

    const jump = useCallback(() => {
        const s = stateRef.current;
        if (s.phase !== "playing") return;
        const p = s.player;
        if (p.grounded) {
            p.vy = JUMP_V;
            p.grounded = false;
        }
    }, []);

    const startGame = useCallback(() => {
        stateRef.current = makeState();
        stateRef.current.phase = "playing";
        setPhase("playing");
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.code === "Space") {
                e.preventDefault();
                jump();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [jump, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;

        function drawGrid(offset: number) {
            ctx.save();
            ctx.strokeStyle = "rgba(0,255,200,0.06)";
            ctx.lineWidth = 1;
            const sz = 40;
            const cols = Math.ceil(W / sz) + 2;
            const rows = Math.ceil(H / sz) + 2;
            const ox = (((-offset) % sz) + sz) % sz;
            for (let c = -1; c < cols; c++) {
                ctx.beginPath();
                ctx.moveTo(c * sz + ox, 0);
                ctx.lineTo(c * sz + ox, H);
                ctx.stroke();
            }
                // mark completion on dead/won for local player
                try {
                    if (!completedTasks || !completedTasks[TASK_ID]) {
                        markTaskCompleted(TASK_ID);
                        const pts = Math.min(20, Math.max(5, Math.round(stateRef.current.score / 100)));
                        socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: pts });
                    }
                } catch (e) {
                    console.warn("task emit failed", e);
                }
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * sz);
                ctx.lineTo(W, r * sz);
                ctx.stroke();
            }
            ctx.restore();
        }

        function drawGlow(
            x: number,
            y: number,
            r: number,
            color: string,
            alpha = 0.35
        ) {
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, color.replace(")", `,${alpha})`).replace("rgb", "rgba"));
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawPlayer(p: Player) {
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;
            const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
            if (flash) return;

            drawGlow(cx, cy, 50, "rgb(0,255,200)", 0.3);

            const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
            grad.addColorStop(0, "#00ffcc");
            grad.addColorStop(1, "#0088ff");
            ctx.fillStyle = grad;
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 12;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.shadowBlur = 0;

            ctx.strokeStyle = "#ffffff44";
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);

            ctx.fillStyle = "#001a22";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("TX", cx, cy);
        }

        function drawObstacle(o: Obstacle) {
            ctx.save();
            ctx.shadowColor = "#ff2244";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#ff2244";
            ctx.beginPath();
            ctx.moveTo(o.x + o.w / 2, o.y);
            ctx.lineTo(o.x + o.w, o.y + o.h);
            ctx.lineTo(o.x, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#ff8899";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        function drawCoin(c: Coin) {
            const color = c.gold ? "#ffd700" : "#00aaff";
            const glow = c.gold ? "rgb(255,215,0)" : "rgb(0,170,255)";
            drawGlow(c.x, c.y, 22 + Math.sin(c.pulse) * 5, glow, 0.4);
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff55";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#00000066";
            ctx.font = `bold ${Math.floor(c.r)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Ξ", c.x, c.y);
            ctx.restore();
        }

        function drawGate(g: Gate) {
            const color = g.open ? "#00ff88" : "#ff6600";
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            if (!g.open) {
                ctx.fillStyle = color + "22";
                ctx.fillRect(g.x, g.y, g.w, g.h);
                ctx.strokeRect(g.x, g.y, g.w, g.h);
                ctx.fillStyle = color;
                ctx.font = "bold 11px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(`⛽${g.cost}`, g.x + g.w / 2, g.y + g.h / 2 - 10);
                ctx.font = "9px monospace";
                ctx.fillText("FEE GATE", g.x + g.w / 2, g.y + g.h / 2 + 8);
            } else {
                ctx.strokeStyle = "#00ff88";
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(g.x, g.y, g.w, g.h);
            }
            ctx.restore();
        }

        function drawParticle(pt: Particle) {
            const alpha = pt.life / pt.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = pt.color;
            ctx.shadowColor = pt.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawHUD(s: GameState) {
            const p = s.player;
            ctx.save();

            ctx.fillStyle = "rgba(0,10,20,0.75)";
            ctx.fillRect(0, 0, W, 50);
            ctx.strokeStyle = "rgba(0,255,200,0.2)";
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, W, 50);

            ctx.fillStyle = "#00ffcc44";
            ctx.fillRect(10, 10, 100, 12);
            const ep = Math.max(0, p.energy / p.maxEnergy);
            const eColor =
                ep > 0.5 ? "#00ff88" : ep > 0.25 ? "#ffcc00" : "#ff3344";
            ctx.fillStyle = eColor;
            ctx.shadowColor = eColor;
            ctx.shadowBlur = 5;
            ctx.fillRect(10, 10, 100 * ep, 12);
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#aaffee";
            ctx.font = "9px monospace";
            ctx.textAlign = "left";
            ctx.fillText("ENERGY", 12, 9);

            ctx.fillStyle = "#00ffcc";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`⛽ ${p.gas}`, 120, 20);

            const secsLeft = Math.max(0, Math.ceil((TIME_LIMIT - s.frame) / 60));
            const timerColor = secsLeft <= 5 ? "#ff3344" : secsLeft <= 10 ? "#ffcc00" : "#00ffcc";
            ctx.fillStyle = timerColor;
            ctx.shadowColor = timerColor;
            ctx.shadowBlur = secsLeft <= 5 ? 10 : 0;
            ctx.font = `bold ${secsLeft <= 5 ? 16 : 13}px monospace`;
            ctx.textAlign = "center";
            ctx.fillText(`⏱ ${secsLeft}s`, W / 2, 22);
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#556677";
            ctx.font = "9px monospace";
            ctx.fillText("TIME", W / 2, 36);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 13px monospace";
            ctx.textAlign = "right";
            ctx.fillText(`${Math.floor(s.score)}`, W - 10, 22);
            ctx.fillStyle = "#aaaaaa";
            ctx.font = "9px monospace";
            ctx.fillText("SCORE", W - 10, 34);

            ctx.restore();
        }

        function drawGround() {
            ctx.save();
            const grad = ctx.createLinearGradient(0, GROUND, 0, H);
            grad.addColorStop(0, "#00ffcc33");
            grad.addColorStop(1, "#001a1a");
            ctx.fillStyle = grad;
            ctx.fillRect(0, GROUND, W, H - GROUND);
            ctx.strokeStyle = "#00ffcc88";
            ctx.lineWidth = 2;
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, GROUND);
            ctx.lineTo(W, GROUND);
            ctx.stroke();
            ctx.restore();
        }

        function update(s: GameState) {
            if (s.phase !== "playing") return;
            s.frame++;
            s.score += 0.05 + s.speed * 0.01;
            s.speed = Math.min(5.5, 2.2 + s.frame * 0.0002);
            s.gridOffset += s.speed;

            const p = s.player;
            if (p.invincible > 0) p.invincible--;

            p.vy += GRAVITY;
            p.y += p.vy;
            if (p.y >= GROUND - p.h) {
                p.y = GROUND - p.h;
                p.vy = 0;
                p.grounded = true;
            }

            s.spawnTimers.obstacle -= 1;
            s.spawnTimers.coin -= 1;
            s.spawnTimers.gate -= 1;

            const obstacleInterval = Math.max(60, 130 - s.frame * 0.035);
            if (s.spawnTimers.obstacle <= 0) {
                const h = 16 + Math.random() * 22;
                s.obstacles.push({ x: W + 10, y: GROUND - h, w: 22, h });
                s.spawnTimers.obstacle = obstacleInterval + Math.random() * 50;
            }

            const coinInterval = Math.max(30, 45 - s.frame * 0.005);
            if (s.spawnTimers.coin <= 0) {
                const gold = Math.random() < 0.25;
                s.coins.push({
                    x: W + 10,
                    y: GROUND - 60 - Math.random() * 200,
                    r: gold ? 12 : 9,
                    gold,
                    collected: false,
                    pulse: 0,
                });
                s.spawnTimers.coin = coinInterval + Math.random() * 20;
            }

            if (s.spawnTimers.gate <= 0) {
                const cost = 3 + Math.floor(Math.random() * 6);
                s.gates.push({
                    x: W + 10,
                    y: GROUND - H + 60,
                    w: 30,
                    h: H - 120,
                    cost,
                    open: false,
                    openTimer: 0,
                });
                s.spawnTimers.gate = 550 + Math.random() * 250;
            }

            s.obstacles = s.obstacles.filter((o) => {
                o.x -= s.speed;
                if (
                    p.invincible === 0 &&
                    rectsOverlap(p.x + 4, p.y + 4, p.w - 8, p.h - 8, o.x, o.y, o.w, o.h)
                ) {
                    p.energy -= 15;
                    p.invincible = 90;
                    spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, "#ff2244", 10);
                    if (p.energy <= 0) {
                        p.energy = 0;
                        s.phase = "dead";
                    }
                }
                return o.x + o.w > -10;
            });

            s.coins = s.coins.filter((c) => {
                c.x -= s.speed;
                c.pulse += 0.1;
                if (!c.collected && circleRect(c.x, c.y, c.r, p.x, p.y, p.w, p.h)) {
                    c.collected = true;
                    const val = c.gold ? 5 : 1;
                    p.gas += val;
                    s.coinsCollected++;
                    s.score += val * 10;
                    const col = c.gold ? "#ffd700" : "#00aaff";
                    spawnParticles(s.particles, c.x, c.y, col, 10);
                }
                return c.x + c.r > -10 && !c.collected;
            });

            s.gates = s.gates.filter((g) => {
                g.x -= s.speed;
                if (!g.open && g.openTimer === 0) {
                    if (rectsOverlap(p.x, p.y, p.w, p.h, g.x, g.y, g.w, g.h)) {
                        if (p.gas >= g.cost) {
                            p.gas -= g.cost;
                            g.open = true;
                            g.openTimer = 60;
                            spawnParticles(s.particles, g.x + g.w / 2, g.y + g.h / 2, "#00ff88", 12);
                        } else {
                            if (p.invincible === 0) {
                                p.energy -= 8;
                                p.invincible = 70;
                                spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, "#ff6600", 8);
                                if (p.energy <= 0) {
                                    p.energy = 0;
                                    s.phase = "dead";
                                }
                            }
                        }
                    }
                }
                if (g.openTimer > 0) g.openTimer--;
                return g.x + g.w > -10;
            });

            s.particles = s.particles.filter((pt) => {
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.vy += 0.1;
                pt.life--;
                return pt.life > 0;
            });

            if (s.frame >= TIME_LIMIT) {
                s.phase = "won";
                for (let i = 0; i < 40; i++) {
                    spawnParticles(
                        s.particles,
                        Math.random() * W,
                        Math.random() * H * 0.6,
                        ["#00ffcc", "#ffd700", "#0088ff", "#ff88ff"][Math.floor(Math.random() * 4)],
                        6
                    );
                }
            }
        }

        function drawStartScreen() {
            ctx.save();
            ctx.fillStyle = "rgba(0,5,15,0.92)";
            ctx.fillRect(0, 0, W, H);

            const t = Date.now() / 1000;
            const titleY = H / 2 - 80;

            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 30;
            ctx.fillStyle = "#00ffcc";
            ctx.font = "bold 32px monospace";
            ctx.textAlign = "center";
            ctx.fillText("GAS FEE", W / 2, titleY);
            ctx.fillStyle = "#0088ff";
            ctx.shadowColor = "#0088ff";
            ctx.fillText("RUNNER", W / 2, titleY + 42);
            ctx.shadowBlur = 0;

            ctx.fillStyle = "#88ccbb";
            ctx.font = "11px monospace";
            ctx.fillText("Fuel your transaction.", W / 2, titleY + 80);
            ctx.fillStyle = "#556677";
            ctx.fillText("Survive the mempool.", W / 2, titleY + 98);

            const bx = W / 2 - 90;
            const by = titleY + 130;
            const pulse = Math.sin(t * 3) * 0.15 + 0.85;
            ctx.save();
            ctx.translate(W / 2, by + 20);
            ctx.scale(pulse, pulse);
            ctx.translate(-W / 2, -(by + 20));
            const bgrad = ctx.createLinearGradient(bx, by, bx + 180, by + 44);
            bgrad.addColorStop(0, "#00ffcc");
            bgrad.addColorStop(1, "#0088ff");
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 15;
            ctx.fillStyle = bgrad;
            ctx.beginPath();
            ctx.rect(bx, by, 180, 44);
            ctx.fill();
            ctx.fillStyle = "#001a22";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.shadowBlur = 0;
            ctx.fillText("START TRANSACTION", W / 2, by + 27);
            ctx.restore();

            ctx.fillStyle = "#334455";
            ctx.font = "10px monospace";
            ctx.fillText("SPACE / TAP to jump", W / 2, by + 90);
            ctx.restore();
        }

        function drawDeadScreen(s: GameState) {
            ctx.save();
            ctx.fillStyle = "rgba(0,2,8,0.88)";
            ctx.fillRect(0, 0, W, H);

            ctx.fillStyle = "#ff2244";
            ctx.shadowColor = "#ff2244";
            ctx.shadowBlur = 20;
            ctx.font = "bold 28px monospace";
            ctx.textAlign = "center";
            ctx.fillText("TRANSACTION", W / 2, H / 2 - 100);
            ctx.fillText("REJECTED", W / 2, H / 2 - 65);
            ctx.shadowBlur = 0;

            ctx.fillStyle = "#aaccbb";
            ctx.font = "13px monospace";
            ctx.fillText(`SCORE: ${Math.floor(s.score)}`, W / 2, H / 2 - 20);
            ctx.fillStyle = "#0088ff";
            ctx.fillText(`⛽ GAS COLLECTED: ${s.coinsCollected}`, W / 2, H / 2 + 5);

            const bx = W / 2 - 75;
            const by = H / 2 + 40;
            const bgrad = ctx.createLinearGradient(bx, by, bx + 150, by + 44);
            bgrad.addColorStop(0, "#ff2244");
            bgrad.addColorStop(1, "#ff6600");
            ctx.shadowColor = "#ff2244";
            ctx.shadowBlur = 12;
            ctx.fillStyle = bgrad;
            ctx.beginPath();
            ctx.rect(bx, by, 150, 44);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px monospace";
            ctx.shadowBlur = 0;
            ctx.fillText("RETRY", W / 2, by + 27);
            ctx.restore();
        }

        function drawWinScreen(s: GameState) {
            ctx.save();
            ctx.fillStyle = "rgba(0,8,5,0.90)";
            ctx.fillRect(0, 0, W, H);

            const t = Date.now() / 1000;
            const pulse = Math.sin(t * 4) * 0.12 + 0.88;

            ctx.save();
            ctx.translate(W / 2, H / 2 - 110);
            ctx.scale(pulse, pulse);
            ctx.translate(-W / 2, -(H / 2 - 110));
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 35;
            ctx.fillStyle = "#00ffcc";
            ctx.font = "bold 30px monospace";
            ctx.textAlign = "center";
            ctx.fillText("TRANSACTION", W / 2, H / 2 - 120);
            ctx.fillStyle = "#ffd700";
            ctx.shadowColor = "#ffd700";
            ctx.fillText("CONFIRMED! ✓", W / 2, H / 2 - 82);
            ctx.restore();
            ctx.shadowBlur = 0;

            ctx.fillStyle = "#aaffee";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Block mined successfully.", W / 2, H / 2 - 45);

            ctx.fillStyle = "#00ffcc";
            ctx.font = "bold 13px monospace";
            ctx.fillText(`FINAL SCORE: ${Math.floor(s.score)}`, W / 2, H / 2 - 10);
            ctx.fillStyle = "#ffd700";
            ctx.fillText(`⛽ GAS COLLECTED: ${s.coinsCollected}`, W / 2, H / 2 + 15);
            ctx.fillStyle = "#88aaff";
            ctx.font = "11px monospace";
            ctx.fillText(`ENERGY REMAINING: ${Math.floor(s.player.energy)}%`, W / 2, H / 2 + 38);

            const bx = W / 2 - 80;
            const by = H / 2 + 70;
            const bgrad = ctx.createLinearGradient(bx, by, bx + 160, by + 44);
            bgrad.addColorStop(0, "#00ffcc");
            bgrad.addColorStop(1, "#ffd700");
            ctx.shadowColor = "#00ffcc";
            ctx.shadowBlur = 15;
            ctx.fillStyle = bgrad;
            ctx.beginPath();
            ctx.rect(bx, by, 160, 44);
            ctx.fill();
            ctx.fillStyle = "#001a10";
            ctx.font = "bold 13px monospace";
            ctx.shadowBlur = 0;
            ctx.fillText("PLAY AGAIN", W / 2, by + 27);
            ctx.restore();
        }

        function render(s: GameState) {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = "#00050f";
            ctx.fillRect(0, 0, W, H);

            drawGrid(s.gridOffset);
            drawGround();

            s.gates.forEach(drawGate);
            s.obstacles.forEach(drawObstacle);
            s.coins.forEach(drawCoin);
            s.particles.forEach(drawParticle);

            if (s.phase === "playing" || s.phase === "dead" || s.phase === "won") {
                drawPlayer(s.player);
                drawHUD(s);
            }

            if (s.phase === "start") drawStartScreen();
            if (s.phase === "dead") drawDeadScreen(s);
            if (s.phase === "won") drawWinScreen(s);
        }

        let lastHudUpdate = 0;

        function loop(time: number) {
            const s = stateRef.current;
            update(s);
            render(s);

            if (time - lastHudUpdate > 100) {
                lastHudUpdate = time;
                setHud({
                    score: Math.floor(s.score),
                    gas: s.player.gas,
                    energy: s.player.energy,
                    coins: s.coinsCollected,
                });
                if (s.phase !== phase) {
                    setPhase(s.phase);
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        }

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isOpen]);

    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const s = stateRef.current;
        if (s.phase === "start") {
            startGame();
            return;
        }
        if (s.phase === "dead" || s.phase === "won") {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = W / rect.width;
            const scaleY = H / rect.height;
            const clientX =
                "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
            const clientY =
                "touches" in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY;
            const cx = (clientX - rect.left) * scaleX;
            const cy = (clientY - rect.top) * scaleY;
            const by = s.phase === "won" ? H / 2 + 70 : H / 2 + 40;
            const bw = s.phase === "won" ? 160 : 150;
            if (cx >= W / 2 - bw / 2 && cx <= W / 2 + bw / 2 && cy >= by && cy <= by + 44) {
                startGame();
                return;
            }
            return;
        }
        jump();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "20px",
            }}
        >
            <div
                style={{
                    display: "inline-block",
                    fontFamily: "monospace",
                    background: "#00050f",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid #00ffcc33",
                    boxShadow: "0 0 40px #00ffcc22, 0 0 80px #0088ff11",
                    position: "relative",
                    maxWidth: "100%",
                    maxHeight: "95vh",
                    touchAction: "none",
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid #00ffcc44",
                        color: "#00ffcc",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        cursor: "pointer",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                    }}
                >
                    ✕
                </button>
                <canvas
                    ref={canvasRef}
                    width={W}
                    height={H}
                    onClick={handleCanvasClick}
                    onTouchStart={handleCanvasClick}
                    style={{
                        display: "block",
                        cursor: "pointer",
                        maxWidth: "100%",
                        height: "auto",
                        maxHeight: "calc(95vh - 0px)",
                    }}
                />
            </div>
        </div>
    );
}