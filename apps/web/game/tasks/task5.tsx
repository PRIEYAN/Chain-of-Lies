import { useRef, useState, useEffect, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GameState = "idle" | "playing" | "over";

interface Block {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    type: "valid" | "malicious";
    opacity: number;
    trail: { x: number; y: number }[];
}

interface GameData {
    blocks: Block[];
    paddleX: number;
    score: number;
    combo: number;
    health: number;
    timeLeft: number;
    lastSpawn: number;
    spawnInterval: number;
    baseSpeed: number;
    blockIdCounter: number;
    particles: Particle[];
    lastTimestamp: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

const W = 380;
const H = 560;
const PADDLE_W = 80;
const PADDLE_H = 14;
const PADDLE_Y = H - 40;
const BLOCK_W = 48;
const BLOCK_H = 28;
const GAME_DURATION = 30;

function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,245,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, combo: number) {
    const cx = x;
    const cy = PADDLE_Y;
    const glow = Math.min(combo * 4, 24);

    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 16 + glow;

    const grad = ctx.createLinearGradient(cx - PADDLE_W / 2, cy, cx + PADDLE_W / 2, cy + PADDLE_H);
    grad.addColorStop(0, "#00f5ff");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(1, "#00f5ff");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(cx - PADDLE_W / 2, cy, PADDLE_W, PADDLE_H, 6);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function drawBlock(ctx: CanvasRenderingContext2D, block: Block) {
    const { x, y, type, opacity } = block;
    const isValid = type === "valid";
    const primary = isValid ? "#00ff9f" : "#ff3c5a";
    const secondary = isValid ? "#00c870" : "#cc2040";

    ctx.save();
    ctx.globalAlpha = opacity;

    for (let i = block.trail.length - 1; i >= 0; i--) {
        const t = block.trail[i];
        const trailAlpha = ((block.trail.length - i) / block.trail.length) * 0.12;
        ctx.globalAlpha = opacity * trailAlpha;
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.roundRect(t.x - BLOCK_W / 2, t.y, BLOCK_W, BLOCK_H, 4);
        ctx.fill();
    }

    ctx.globalAlpha = opacity;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 18;

    const grad = ctx.createLinearGradient(x - BLOCK_W / 2, y, x - BLOCK_W / 2, y + BLOCK_H);
    grad.addColorStop(0, primary + "ee");
    grad.addColorStop(1, secondary + "cc");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x - BLOCK_W / 2, y, BLOCK_W, BLOCK_H, 4);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = opacity * 0.8;
    ctx.stroke();

    ctx.globalAlpha = opacity;
    ctx.fillStyle = isValid ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.55)";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(isValid ? "VALID" : "MALICIOUS", x, y + BLOCK_H / 2 + 3);

    ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
    for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawHUD(ctx: CanvasRenderingContext2D, data: GameData) {
    const { score, combo, health, timeLeft } = data;

    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 8, W - 16, 42, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,245,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = "#00f5ff";
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 8;
    ctx.fillText("SCORE", 20, 26);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText(score.toString(), 20, 42);

    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = combo > 1 ? "#ffd700" : "#ffffff44";
    ctx.shadowColor = combo > 1 ? "#ffd700" : "transparent";
    ctx.shadowBlur = combo > 1 ? 10 : 0;
    ctx.fillText(`×${combo} COMBO`, W / 2, 26);
    ctx.shadowBlur = 0;

    const hpColor = health > 60 ? "#00ff9f" : health > 30 ? "#ffd700" : "#ff3c5a";
    ctx.textAlign = "right";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 6;
    ctx.fillText("HEALTH", W - 20, 26);
    ctx.shadowBlur = 0;

    const barW = 70;
    const barX = W - 20 - barW;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(barX, 32, barW, 8, 3);
    ctx.fill();
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(barX, 32, barW * (health / 100), 8, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    const timerStr = Math.ceil(timeLeft).toString().padStart(2, "0");
    const timerColor = timeLeft <= 10 ? "#ff3c5a" : "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `bold 13px 'Courier New', monospace`;
    ctx.fillStyle = timerColor;
    ctx.shadowColor = timerColor;
    ctx.shadowBlur = timeLeft <= 10 ? 10 : 0;
    ctx.fillText(`${timerStr}s`, W / 2, 42);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function spawnBlock(data: GameData): Block {
    const isValid = Math.random() < 0.65;
    const speed = data.baseSpeed + Math.random() * 1.5;
    return {
        id: data.blockIdCounter++,
        x: BLOCK_W / 2 + Math.random() * (W - BLOCK_W),
        y: -BLOCK_H,
        width: BLOCK_W,
        height: BLOCK_H,
        speed,
        type: isValid ? "valid" : "malicious",
        opacity: 1,
        trail: [],
    };
}

function spawnParticles(particles: Particle[], x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 1,
            maxLife: 1,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

export default function BlockCatcherPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task5";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameDataRef = useRef<GameData>({
        blocks: [], paddleX: W / 2, score: 0, combo: 1, health: 100,
        timeLeft: GAME_DURATION, lastSpawn: 0, spawnInterval: 1400,
        baseSpeed: 2.5, blockIdCounter: 0, particles: [], lastTimestamp: 0,
    });
    const gameStateRef = useRef<GameState>("idle");
    const rafRef = useRef<number>(0);
    const [displayState, setDisplayState] = useState<GameState>("idle");
    const [finalScore, setFinalScore] = useState(0);

    const clearTimeouts = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
    };

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            gameDataRef.current = {
                blocks: [], paddleX: W / 2, score: 0, combo: 1, health: 100,
                timeLeft: GAME_DURATION, lastSpawn: 0, spawnInterval: 1400,
                baseSpeed: 2.5, blockIdCounter: 0, particles: [], lastTimestamp: 0,
            };
            gameStateRef.current = "idle";
            setDisplayState("idle");
            setFinalScore(0);
        }
        return () => clearTimeouts();
    }, [isOpen]);

    const endGame = useCallback(() => {
        gameStateRef.current = "over";
        setFinalScore(gameDataRef.current.score);
        setDisplayState("over");
        cancelAnimationFrame(rafRef.current);
    }, []);

    // mark completion when session ends
    useEffect(() => {
        if (displayState === "over") {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [displayState, completedTasks, localPlayerId, markTaskCompleted]);

    const gameLoop = useCallback((timestamp: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const data = gameDataRef.current;

        const dt = data.lastTimestamp ? Math.min((timestamp - data.lastTimestamp) / 1000, 0.05) : 0.016;
        data.lastTimestamp = timestamp;

        data.timeLeft -= dt;
        if (data.timeLeft <= 0) { data.timeLeft = 0; endGame(); return; }

        const elapsed = GAME_DURATION - data.timeLeft;
        data.baseSpeed = 2.5 + elapsed * 0.08;
        data.spawnInterval = Math.max(550, 1400 - elapsed * 20);

        if (timestamp - data.lastSpawn > data.spawnInterval) {
            data.blocks.push(spawnBlock(data));
            data.lastSpawn = timestamp;
        }

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#07071a";
        ctx.fillRect(0, 0, W, H);
        drawGrid(ctx);

        data.blocks = data.blocks.filter((block) => {
            block.trail.push({ x: block.x, y: block.y });
            if (block.trail.length > 5) block.trail.shift();
            block.y += block.speed;

            const px = data.paddleX;
            const hitX = Math.abs(block.x - px) < PADDLE_W / 2 + BLOCK_W / 2 - 6;
            const hitY = block.y + BLOCK_H >= PADDLE_Y && block.y <= PADDLE_Y + PADDLE_H;

            if (hitX && hitY) {
                if (block.type === "valid") {
                    data.score += 10 * data.combo;
                    data.combo = Math.min(data.combo + 1, 10);
                    spawnParticles(data.particles, block.x, PADDLE_Y, "#00ff9f", 12);
                } else {
                    data.health = Math.max(0, data.health - 20);
                    data.combo = 1;
                    spawnParticles(data.particles, block.x, PADDLE_Y, "#ff3c5a", 12);
                    if (data.health <= 0) { endGame(); return false; }
                }
                return false;
            }

            if (block.y > H) {
                if (block.type === "valid") {
                    data.health = Math.max(0, data.health - 10);
                    data.combo = 1;
                    if (data.health <= 0) { endGame(); return false; }
                }
                return false;
            }

            drawBlock(ctx, block);
            return true;
        });

        data.particles = data.particles.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.04;
            return p.life > 0;
        });
        drawParticles(ctx, data.particles);

        drawPaddle(ctx, data.paddleX, data.combo);
        drawHUD(ctx, data);

        rafRef.current = requestAnimationFrame(gameLoop);
    }, [endGame]);

    const startGame = useCallback(() => {
        gameDataRef.current = {
            blocks: [], paddleX: W / 2, score: 0, combo: 1, health: 100,
            timeLeft: GAME_DURATION, lastSpawn: 0, spawnInterval: 1400,
            baseSpeed: 2.5, blockIdCounter: 0, particles: [], lastTimestamp: 0,
        };
        gameStateRef.current = "playing";
        setDisplayState("playing");
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(gameLoop);
    }, [gameLoop]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isOpen) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (gameStateRef.current !== "playing") return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = W / rect.width;
            const raw = (e.clientX - rect.left) * scaleX;
            gameDataRef.current.paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, raw));
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (gameStateRef.current !== "playing") return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = W / rect.width;
            const raw = (e.touches[0].clientX - rect.left) * scaleX;
            gameDataRef.current.paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, raw));
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, [isOpen]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#07071a";
        ctx.fillRect(0, 0, W, H);
        drawGrid(ctx);
    }, [isOpen]);

    if (!isOpen) return null;

    const overlayStyle: React.CSSProperties = {
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
        background: "rgba(7,7,26,0.92)", backdropFilter: "blur(6px)",
        borderRadius: 16, zIndex: 10,
    };

    const btnStyle: React.CSSProperties = {
        marginTop: 12, background: "linear-gradient(135deg, #00f5ff22, #00ff9f22)",
        border: "1px solid #00f5ff99", color: "#00f5ff", padding: "12px 32px",
        borderRadius: 8, fontFamily: "'Courier New', monospace", fontSize: 13,
        fontWeight: 700, cursor: "pointer", letterSpacing: 2,
    };

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
            <div style={{
                position: "relative", width: W, height: H, borderRadius: 16, overflow: "hidden",
                boxShadow: "0 0 60px #00f5ff18, 0 20px 60px #00000088",
                border: "1px solid rgba(0,245,255,0.12)", fontFamily: "'Courier New', monospace",
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid #00f5ff44",
                        color: "#00f5ff",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        cursor: "pointer",
                        zIndex: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                    }}
                >
                    \u2715
                </button>

                <canvas ref={canvasRef} width={W} height={H} style={{ display: "block" }} />

                {displayState === "idle" && (
                    <div style={overlayStyle}>
                        <div style={{ fontSize: 10, color: "#00f5ff88", letterSpacing: 5, marginBottom: 4 }}>
                            BLOCKCHAIN PROTOCOL
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: "#00f5ff", letterSpacing: 3, textShadow: "0 0 30px #00f5ff" }}>
                            BLOCK CATCHER
                        </div>
                        <div style={{ fontSize: 11, color: "#ffffff55", letterSpacing: 1, textAlign: "center", maxWidth: 260, lineHeight: 1.8 }}>
                            Validate transactions.<br />Reject malicious blocks.
                        </div>
                        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                            {[
                                { color: "#00ff9f", label: "VALID", desc: "Catch it" },
                                { color: "#ff3c5a", label: "MALICIOUS", desc: "Avoid it" },
                            ].map((item) => (
                                <div key={item.label} style={{ textAlign: "center" }}>
                                    <div style={{
                                        width: 48, height: 28, borderRadius: 4, margin: "0 auto 6px",
                                        background: item.color + "33", border: `1.5px solid ${item.color}`,
                                        boxShadow: `0 0 12px ${item.color}66`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 8, color: item.color, fontWeight: 700, letterSpacing: 1,
                                    }}>{item.label}</div>
                                    <div style={{ fontSize: 10, color: "#ffffff44" }}>{item.desc}</div>
                                </div>
                            ))}
                        </div>
                        <button style={btnStyle} onClick={startGame}>START VALIDATION</button>
                    </div>
                )}

                {displayState === "over" && (
                    <div style={overlayStyle}>
                        <div style={{ fontSize: 10, color: "#ff3c5a88", letterSpacing: 5 }}>SESSION ENDED</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#ff3c5a", textShadow: "0 0 30px #ff3c5a", letterSpacing: 2 }}>
                            VALIDATION COMPLETE
                        </div>
                        <div style={{ marginTop: 8, textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#ffffff33", letterSpacing: 3 }}>FINAL SCORE</div>
                            <div style={{ fontSize: 48, fontWeight: 700, color: "#ffd700", textShadow: "0 0 20px #ffd700aa", lineHeight: 1.1 }}>
                                {finalScore}
                            </div>
                        </div>
                        <button
                            style={{ ...btnStyle, border: "1px solid #ff3c5a99", color: "#ff3c5a", background: "linear-gradient(135deg, #ff3c5a22, #bf5fff22)" }}
                            onClick={startGame}
                        >
                            RESTART
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
