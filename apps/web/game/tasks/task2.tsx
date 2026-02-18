import { useState, useEffect, useRef, useCallback } from "react";

const CANVAS_W = 380;
const CANVAS_H = 560;
const BLOCK_SIZE = 22;
const NODE_W = 72;
const NODE_H = 14;
const GRAVITY = 0.28;
const JUMP_FORCE = -7.2;
const SCROLL_SPEED = 1.1;
const GAME_DURATION = 30;
const NODE_ROWS = 7;
const NODE_COLS = 3;
const FAILURE_INTERVAL = 4000;

type GameState = "idle" | "playing" | "dead" | "won";

interface Node {
    id: number;
    x: number;
    y: number;
    alive: boolean;
    fadeOut: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

function generateNodes(offsetY: number): Node[] {
    const nodes: Node[] = [];
    let id = 0;
    const cols = [
        CANVAS_W * 0.15,
        CANVAS_W * 0.5,
        CANVAS_W * 0.82,
    ];
    for (let row = 0; row < NODE_ROWS; row++) {
        const shuffledCols = [...cols].sort(() => Math.random() - 0.5).slice(0, 2);
        for (const x of shuffledCols) {
            nodes.push({
                id: id++,
                x: x - NODE_W / 2,
                y: offsetY - row * 110 + Math.random() * 30 - 15,
                alive: true,
                fadeOut: 0,
            });
        }
    }
    return nodes;
}

export default function BlockBouncePopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<{
        gameState: GameState;
        blockX: number;
        blockY: number;
        velX: number;
        velY: number;
        nodes: Node[];
        particles: Particle[];
        scrollY: number;
        timeLeft: number;
        score: number;
        nodeIdCounter: number;
        particleIdCounter: number;
        lastTime: number;
        failureTimer: number;
        bounceCount: number;
    }>({
        gameState: "idle",
        blockX: CANVAS_W / 2,
        blockY: CANVAS_H - 120,
        velX: 2.2,
        velY: 0,
        nodes: [],
        particles: [],
        scrollY: 0,
        timeLeft: GAME_DURATION,
        score: 0,
        nodeIdCounter: 100,
        particleIdCounter: 0,
        failureTimer: 0,
        bounceCount: 0,
        lastTime: 0,
    });

    const [displayState, setDisplayState] = useState<GameState>("idle");
    const [displayTime, setDisplayTime] = useState(GAME_DURATION);
    const [displayScore, setDisplayScore] = useState(0);
    const [finalScore, setFinalScore] = useState(0);
    const rafRef = useRef<number>(0);

    const spawnParticles = useCallback((x: number, y: number, color: string) => {
        const s = stateRef.current;
        for (let i = 0; i < 8; i++) {
            s.particles.push({
                id: s.particleIdCounter++,
                x,
                y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5 - 2,
                life: 1,
                color,
            });
        }
    }, []);

    const startGame = useCallback(() => {
        const s = stateRef.current;
        s.gameState = "playing";
        s.blockX = CANVAS_W / 2;
        s.blockY = CANVAS_H - 120;
        s.velX = 2.2;
        s.velY = -3;
        s.scrollY = 0;
        s.timeLeft = GAME_DURATION;
        s.score = 0;
        s.failureTimer = 0;
        s.bounceCount = 0;
        s.particles = [];
        s.nodes = generateNodes(CANVAS_H - 80);
        s.nodeIdCounter = 100;
        s.lastTime = performance.now();
        setDisplayState("playing");
        setDisplayTime(GAME_DURATION);
        setDisplayScore(0);
    }, []);

    const handleTap = useCallback(() => {
        const s = stateRef.current;
        if (s.gameState === "idle" || s.gameState === "dead" || s.gameState === "won") {
            startGame();
            return;
        }
        if (s.gameState === "playing") {
            s.velX *= -1;
            s.velY = Math.min(s.velY - 1.5, -2);
        }
    }, [startGame]);

    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;

        const draw = (timestamp: number) => {
            const s = stateRef.current;
            const dt = Math.min((timestamp - s.lastTime) / 16.67, 3);
            s.lastTime = timestamp;

            ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

            // Background
            const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
            bg.addColorStop(0, "#03050f");
            bg.addColorStop(1, "#07102a");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

            // Grid lines
            ctx.strokeStyle = "rgba(30,60,120,0.18)";
            ctx.lineWidth = 1;
            for (let x = 0; x < CANVAS_W; x += 40) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
            }
            for (let y = 0; y < CANVAS_H; y += 40) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
            }

            if (s.gameState === "playing") {
                const dtSec = dt / 60;
                s.timeLeft = Math.max(0, s.timeLeft - dtSec);
                s.failureTimer += dt * 16.67;

                // Scroll
                s.scrollY += SCROLL_SPEED * dt;
                s.nodes.forEach(n => { n.y += SCROLL_SPEED * dt; });

                // Fade dying nodes
                s.nodes.forEach(n => {
                    if (!n.alive) n.fadeOut = Math.min(1, n.fadeOut + 0.04 * dt);
                });

                // Kill faded nodes
                s.nodes = s.nodes.filter(n => n.fadeOut < 1);

                // Extend nodes upward
                const topNode = s.nodes.reduce((min, n) => n.y < min ? n.y : min, Infinity);
                while (topNode > -200) {
                    const newY = s.nodes.reduce((min, n) => n.y < min ? n.y : min, Infinity) - 110;
                    const cols = [CANVAS_W * 0.15, CANVAS_W * 0.5, CANVAS_W * 0.82];
                    const shuffled = [...cols].sort(() => Math.random() - 0.5).slice(0, 2);
                    for (const x of shuffled) {
                        s.nodes.push({
                            id: s.nodeIdCounter++,
                            x: x - NODE_W / 2 + (Math.random() * 20 - 10),
                            y: newY + Math.random() * 20 - 10,
                            alive: true,
                            fadeOut: 0,
                        });
                    }
                    break;
                }

                // Remove off-screen nodes
                s.nodes = s.nodes.filter(n => n.y < CANVAS_H + 50);

                // Random node failure
                if (s.failureTimer > FAILURE_INTERVAL) {
                    s.failureTimer = 0;
                    const alive = s.nodes.filter(n => n.alive && n.y > 50 && n.y < CANVAS_H - 50);
                    if (alive.length > 2) {
                        const victim = alive[Math.floor(Math.random() * alive.length)];
                        victim.alive = false;
                        spawnParticles(victim.x + NODE_W / 2, victim.y, "#ff4444");
                    }
                }

                // Physics
                s.velY += GRAVITY * dt;
                s.blockX += s.velX * dt;
                s.blockY += s.velY * dt;

                // Wall bounce
                if (s.blockX < BLOCK_SIZE / 2) { s.blockX = BLOCK_SIZE / 2; s.velX = Math.abs(s.velX); }
                if (s.blockX > CANVAS_W - BLOCK_SIZE / 2) { s.blockX = CANVAS_W - BLOCK_SIZE / 2; s.velX = -Math.abs(s.velX); }

                // Node collision
                for (const node of s.nodes) {
                    if (!node.alive || node.fadeOut > 0) continue;
                    const bx = s.blockX;
                    const by = s.blockY + BLOCK_SIZE / 2;
                    if (
                        s.velY > 0 &&
                        bx > node.x - 4 &&
                        bx < node.x + NODE_W + 4 &&
                        by > node.y &&
                        by < node.y + NODE_H + 8 &&
                        s.blockY + BLOCK_SIZE / 2 - s.velY * dt < node.y + NODE_H
                    ) {
                        s.velY = JUMP_FORCE;
                        s.blockY = node.y - BLOCK_SIZE / 2 - 1;
                        s.bounceCount++;
                        spawnParticles(bx, node.y, "#00f5ff");
                    }
                }

                // Win check — timer reached 0
                if (s.timeLeft <= 0) {
                    s.score = Math.round(GAME_DURATION * 10 + s.bounceCount * 5) + 300;
                    s.gameState = "won";
                    setDisplayState("won");
                    setFinalScore(s.score);
                }

                // Death check — fell off screen
                if (s.blockY > CANVAS_H + 60) {
                    s.score = Math.round((GAME_DURATION - s.timeLeft) * 10 + s.bounceCount * 5);
                    s.gameState = "dead";
                    setDisplayState("dead");
                    setFinalScore(s.score);
                }

                setDisplayTime(Math.ceil(s.timeLeft));
                setDisplayScore(Math.round((GAME_DURATION - s.timeLeft) * 10 + s.bounceCount * 5));
            }

            // Draw nodes
            for (const node of s.nodes) {
                const alpha = 1 - node.fadeOut;
                if (alpha <= 0) continue;
                ctx.save();
                ctx.globalAlpha = alpha;

                if (!node.alive) {
                    ctx.shadowColor = "#ff2200";
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = `rgba(80,10,10,${alpha})`;
                } else {
                    ctx.shadowColor = "#00f5ff";
                    ctx.shadowBlur = 10;
                    const g = ctx.createLinearGradient(node.x, node.y, node.x, node.y + NODE_H);
                    g.addColorStop(0, `rgba(0,200,255,${alpha})`);
                    g.addColorStop(1, `rgba(0,80,160,${alpha})`);
                    ctx.fillStyle = g;
                }

                ctx.beginPath();
                ctx.roundRect(node.x, node.y, NODE_W, NODE_H, 4);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.strokeStyle = node.alive ? `rgba(0,245,255,${alpha * 0.6})` : `rgba(255,60,60,${alpha * 0.6})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Node ID label
                ctx.fillStyle = node.alive ? `rgba(180,240,255,${alpha * 0.7})` : `rgba(255,150,150,${alpha * 0.7})`;
                ctx.font = "8px 'Courier New', monospace";
                ctx.textAlign = "center";
                ctx.fillText(`N${node.id % 100}`, node.x + NODE_W / 2, node.y + NODE_H - 2);
                ctx.restore();
            }

            // Draw particles
            s.particles = s.particles.filter(p => p.life > 0);
            for (const p of s.particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.life -= 0.04;
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
                ctx.restore();
            }

            // Draw block
            if (s.gameState === "playing" || s.gameState === "dead") {
                const bx = s.blockX;
                const by = s.blockY;
                ctx.save();
                ctx.shadowColor = "#00ffcc";
                ctx.shadowBlur = 18;
                const bg2 = ctx.createLinearGradient(bx - BLOCK_SIZE / 2, by - BLOCK_SIZE / 2, bx + BLOCK_SIZE / 2, by + BLOCK_SIZE / 2);
                bg2.addColorStop(0, "#00ffcc");
                bg2.addColorStop(1, "#0088aa");
                ctx.fillStyle = s.gameState === "dead" ? "#ff4444" : bg2;
                ctx.beginPath();
                ctx.roundRect(bx - BLOCK_SIZE / 2, by - BLOCK_SIZE / 2, BLOCK_SIZE, BLOCK_SIZE, 4);
                ctx.fill();
                ctx.strokeStyle = s.gameState === "dead" ? "#ff8888" : "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Block label
                ctx.fillStyle = "#001a1a";
                ctx.font = "bold 7px 'Courier New', monospace";
                ctx.textAlign = "center";
                ctx.fillText("BLK", bx, by + 2.5);
                ctx.restore();

                // Trail
                if (s.gameState === "playing") {
                    for (let t = 1; t <= 4; t++) {
                        ctx.save();
                        ctx.globalAlpha = 0.12 * (5 - t);
                        ctx.fillStyle = "#00ffcc";
                        ctx.beginPath();
                        ctx.roundRect(bx - s.velX * t * 1.5 - 4, by - s.velY * t * 0.5 - 4, 8, 8, 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }

            // Idle / dead overlay
            if (s.gameState === "idle" || s.gameState === "dead") {
                ctx.fillStyle = "rgba(3,5,20,0.6)";
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [spawnParticles, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "ArrowLeft" || e.code === "ArrowRight") {
                e.preventDefault();
                handleTap();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleTap, isOpen]);

    if (!isOpen) return null;

    const timerPct = displayTime / GAME_DURATION;
    const timerColor = timerPct > 0.5 ? "#00f5ff" : timerPct > 0.25 ? "#ffcc00" : "#ff4444";

    return (
        <div style={css.overlay}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@600;700&display=swap');
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,245,255,0.3); }
          50% { box-shadow: 0 0 40px rgba(0,245,255,0.6); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .bounce-btn {
          animation: pulse-glow 2s ease-in-out infinite;
          transition: transform 0.1s ease, filter 0.1s ease;
        }
        .bounce-btn:hover {
          transform: scale(1.04);
          filter: brightness(1.2);
        }
        .bounce-btn:active {
          transform: scale(0.97);
        }
      `}</style>

            <div style={css.modal}>
                <button style={css.closeBtn} onClick={onClose}>
                    ✕
                </button>

                <div style={css.wrapper}>
                    <div style={css.titleBar}>
                        <span style={css.titleTag}>[ DISTRIBUTED NET ]</span>
                        <h1 style={css.title}>BLOCK BOUNCE</h1>
                        <p style={css.subtitle}>Network Resilience Simulation</p>
                    </div>

                    <div style={css.gameArea}>
                        {/* HUD */}
                        {displayState === "playing" && (
                            <div style={css.hud}>
                                <div style={css.hudLeft}>
                                    <span style={css.hudLabel}>SCORE</span>
                                    <span style={css.hudValue}>{displayScore.toString().padStart(5, "0")}</span>
                                </div>
                                <div style={css.hudCenter}>
                                    <div style={css.timerBar}>
                                        <div
                                            style={{
                                                ...css.timerFill,
                                                width: `${timerPct * 100}%`,
                                                background: timerColor,
                                                boxShadow: `0 0 8px ${timerColor}`,
                                            }}
                                        />
                                    </div>
                                    <span style={{ ...css.timerText, color: timerColor }}>
                                        {displayTime}s
                                    </span>
                                </div>
                                <div style={css.hudRight}>
                                    <span style={css.hudLabel}>TAP / SPC</span>
                                    <span style={{ ...css.hudLabel, color: "#00f5ff", animation: "blink 1s infinite" }}>
                                        ◀▶ FLIP
                                    </span>
                                </div>
                            </div>
                        )}

                        <div style={css.canvasWrap}>
                            <canvas
                                ref={canvasRef}
                                width={CANVAS_W}
                                height={CANVAS_H}
                                style={css.canvas}
                                onClick={handleTap}
                            />

                            {/* Scanline overlay */}
                            <div style={css.scanlineOverlay} />

                            {/* Idle screen */}
                            {displayState === "idle" && (
                                <div style={css.gameOverlay}>
                                    <div style={css.overlayIcon}>⬡</div>
                                    <h2 style={css.overlayTitle}>READY TO ROUTE?</h2>
                                    <p style={css.overlayBody}>
                                        Bounce between <span style={{ color: "#00f5ff" }}>network nodes</span>.
                                        <br />Nodes fail randomly — reroute or perish.
                                        <br />Survive <span style={{ color: "#ffcc00" }}>30 seconds</span> for max score.
                                    </p>
                                    <div style={css.controls}>
                                        <span style={css.ctrlItem}>📱 TAP to flip direction</span>
                                        <span style={css.ctrlItem}>⌨ SPACE / ARROW to control</span>
                                    </div>
                                    <button className="bounce-btn" style={css.startBtn} onClick={handleTap}>
                                        INITIALIZE NODE
                                    </button>
                                </div>
                            )}

                            {/* Death screen */}
                            {displayState === "dead" && (
                                <div style={css.gameOverlay}>
                                    <div style={{ ...css.overlayIcon, color: "#ff4444" }}>✕</div>
                                    <h2 style={{ ...css.overlayTitle, color: "#ff6060" }}>CONNECTION LOST</h2>
                                    <p style={css.overlayBody}>Block failed to reroute around faulty nodes.</p>
                                    <div style={css.scoreDisplay}>
                                        <span style={css.scoreLabel}>FINAL SCORE</span>
                                        <span style={css.scoreBig}>{finalScore.toString().padStart(6, "0")}</span>
                                    </div>
                                    <button className="bounce-btn" style={css.startBtn} onClick={handleTap}>
                                        RECONNECT
                                    </button>
                                </div>
                            )}

                            {/* Win screen */}
                            {displayState === "won" && (
                                <div style={css.gameOverlay}>
                                    <div style={{ ...css.overlayIcon, color: "#00ff99", fontSize: "42px" }}>⬡</div>
                                    <h2 style={{ ...css.overlayTitle, color: "#00ff99", textShadow: "0 0 20px rgba(0,255,153,0.6)" }}>
                                        NETWORK STABILIZED
                                    </h2>
                                    <p style={{ ...css.overlayBody, color: "#4aaa7a" }}>
                                        You survived all node failures.<br />
                                        <span style={{ color: "#ffcc00" }}>Distributed resilience achieved.</span>
                                    </p>
                                    <div style={{ ...css.scoreDisplay, borderColor: "#00ff99", background: "rgba(0,40,20,0.6)" }}>
                                        <span style={css.scoreLabel}>FINAL SCORE</span>
                                        <span style={{ ...css.scoreBig, color: "#00ff99", textShadow: "0 0 20px rgba(0,255,153,0.5)" }}>
                                            {finalScore.toString().padStart(6, "0")}
                                        </span>
                                        <span style={{ color: "#ffcc00", fontSize: "11px", letterSpacing: "2px", marginTop: "4px" }}>
                                            ★ RESILIENT NETWORK ★
                                        </span>
                                    </div>
                                    <button
                                        className="bounce-btn"
                                        style={{ ...css.startBtn, borderColor: "#00ff99", color: "#00ff99", background: "linear-gradient(135deg, #003a20, #005a38)" }}
                                        onClick={handleTap}
                                    >
                                        PLAY AGAIN
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={css.footer}>
                        <span style={css.footerItem}>⬡ NODES: active</span>
                        <span style={{ ...css.footerItem, color: "#ff6060" }}>⬡ FAULT: random eviction</span>
                        <span style={{ ...css.footerItem, color: "#ffcc00" }}>⬡ GOAL: 30s survival</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

const css: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    },
    modal: {
        background: "#030510",
        padding: "20px 30px",
        borderRadius: "16px",
        width: "auto",
        maxWidth: "95vw",
        maxHeight: "98vh",
        textAlign: "center",
        boxShadow: "0 0 40px rgba(0,245,255,0.2)",
        position: "relative",
        border: "1px solid #0a3050",
        overflow: "hidden",
    },
    closeBtn: {
        position: "absolute",
        top: "15px",
        right: "15px",
        background: "transparent",
        border: "none",
        color: "#aaa",
        fontSize: "20px",
        cursor: "pointer",
        zIndex: 100,
    },
    wrapper: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0px",
    },
    titleBar: {
        textAlign: "center",
        marginBottom: "12px",
    },
    titleTag: {
        fontSize: "10px",
        letterSpacing: "3px",
        color: "#1a4a6a",
        display: "block",
        marginBottom: "6px",
    },
    title: {
        fontFamily: "'Rajdhani', 'Share Tech Mono', sans-serif",
        fontSize: "28px",
        fontWeight: 700,
        color: "#00f5ff",
        margin: "0 0 4px",
        letterSpacing: "6px",
        textShadow: "0 0 30px rgba(0,245,255,0.6), 0 0 60px rgba(0,245,255,0.2)",
    },
    subtitle: {
        fontSize: "11px",
        color: "#2a5a7a",
        letterSpacing: "3px",
        margin: 0,
        textTransform: "uppercase",
    },
    gameArea: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0",
    },
    hud: {
        width: CANVAS_W,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "rgba(0,20,40,0.8)",
        border: "1px solid #0a3050",
        borderBottom: "none",
        borderRadius: "8px 8px 0 0",
        boxSizing: "border-box",
    },
    hudLeft: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
    hudCenter: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        padding: "0 16px",
    },
    hudRight: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "2px",
    },
    hudLabel: {
        fontSize: "9px",
        letterSpacing: "2px",
        color: "#2a5a7a",
    },
    hudValue: {
        fontSize: "16px",
        color: "#00f5ff",
        letterSpacing: "2px",
        textShadow: "0 0 10px rgba(0,245,255,0.5)",
    },
    timerBar: {
        width: "100%",
        height: "4px",
        background: "#0a1a2a",
        borderRadius: "2px",
        overflow: "hidden",
    },
    timerFill: {
        height: "100%",
        borderRadius: "2px",
        transition: "width 0.5s linear, background 0.5s ease",
    },
    timerText: {
        fontSize: "11px",
        letterSpacing: "1px",
        transition: "color 0.5s ease",
    },
    canvasWrap: {
        position: "relative",
        border: "1px solid #0a3050",
        borderRadius: "0 0 8px 8px",
        overflow: "hidden",
        cursor: "pointer",
    },
    canvas: {
        display: "block",
    },
    scanlineOverlay: {
        position: "absolute",
        inset: 0,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
        pointerEvents: "none",
    },
    gameOverlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "rgba(3,5,20,0.82)",
        padding: "24px",
        boxSizing: "border-box",
    },
    overlayIcon: {
        fontSize: "36px",
        color: "#00f5ff",
        textShadow: "0 0 20px rgba(0,245,255,0.8)",
        lineHeight: 1,
    },
    overlayTitle: {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: "22px",
        fontWeight: 700,
        letterSpacing: "4px",
        color: "#00f5ff",
        margin: 0,
        textShadow: "0 0 20px rgba(0,245,255,0.5)",
    },
    overlayBody: {
        fontSize: "12px",
        color: "#4a7a9a",
        textAlign: "center",
        lineHeight: 1.8,
        margin: 0,
        letterSpacing: "0.5px",
    },
    controls: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        alignItems: "center",
    },
    ctrlItem: {
        fontSize: "10px",
        color: "#2a4a6a",
        letterSpacing: "1px",
    },
    startBtn: {
        background: "linear-gradient(135deg, #003a50, #005a78)",
        border: "1px solid #00f5ff",
        color: "#00f5ff",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: "13px",
        letterSpacing: "3px",
        padding: "12px 28px",
        borderRadius: "6px",
        cursor: "pointer",
        marginTop: "4px",
        textShadow: "0 0 10px rgba(0,245,255,0.5)",
    },
    scoreDisplay: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "16px 28px",
        border: "1px solid #1a3a5a",
        borderRadius: "8px",
        background: "rgba(0,20,40,0.6)",
    },
    scoreLabel: {
        fontSize: "10px",
        letterSpacing: "3px",
        color: "#2a5a7a",
    },
    scoreBig: {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: "38px",
        fontWeight: 700,
        color: "#00f5ff",
        letterSpacing: "4px",
        textShadow: "0 0 20px rgba(0,245,255,0.5)",
        lineHeight: 1,
    },
    footer: {
        display: "flex",
        gap: "20px",
        marginTop: "12px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    footerItem: {
        fontSize: "10px",
        letterSpacing: "1px",
        color: "#1a6a4a",
    },
};