import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GameState = "idle" | "selecting" | "spinning" | "result";
type SectorColor = "red" | "green" | "violet";

interface Sector {
    color: SectorColor;
    label: string;
    neon: string;
    dim: string;
    points: number;
    count: number;
}

const SECTORS: Sector[] = [
    { color: "red", label: "RED", neon: "#ff3c5a", dim: "#7a1a28", points: 10, count: 4 },
    { color: "green", label: "GREEN", neon: "#00ff9f", dim: "#005c3a", points: 10, count: 4 },
    { color: "violet", label: "VIOLET", neon: "#bf5fff", dim: "#4a1a7a", points: 50, count: 1 },
];

const PREDICTION_TIME = 5;
const SPIN_DURATION = 4000;

function buildWheel(): SectorColor[] {
    const wheel: SectorColor[] = [];
    SECTORS.forEach((s) => { for (let i = 0; i < s.count; i++) wheel.push(s.color); });
    for (let i = wheel.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wheel[i], wheel[j]] = [wheel[j], wheel[i]];
    }
    return wheel;
}

function getSector(color: SectorColor): Sector {
    return SECTORS.find((s) => s.color === color)!;
}

function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 4);
}

function drawWheel(
    ctx: CanvasRenderingContext2D,
    wheel: SectorColor[],
    rotation: number,
    size: number,
    glowColor: string | null,
    flash: boolean
) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    const total = wheel.length;
    const sliceAngle = (Math.PI * 2) / total;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    wheel.forEach((color, i) => {
        const sector = getSector(color);
        const start = i * sliceAngle - Math.PI / 2;
        const end = start + sliceAngle;
        const isGlow = glowColor === color;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, start, end);
        ctx.closePath();

        if (isGlow && flash) {
            ctx.shadowColor = sector.neon;
            ctx.shadowBlur = 30;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isGlow ? sector.neon : sector.dim;
        ctx.fill();

        ctx.strokeStyle = "#07071a";
        ctx.lineWidth = 2;
        ctx.stroke();

        const midAngle = start + sliceAngle / 2;
        const labelR = r * 0.62;
        const lx = Math.cos(midAngle) * labelR;
        const ly = Math.sin(midAngle) * labelR;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = isGlow ? "#ffffff" : sector.neon + "99";
        ctx.font = `bold ${color === "violet" ? 8 : 9}px 'Courier New', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sector.label, 0, 0);
        ctx.restore();
    });

    ctx.restore();

    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
    grad.addColorStop(0, "#1a1a3a");
    grad.addColorStop(1, "#0d0d22");
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = "#00f5ff44";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const pointerY = 6;
    ctx.save();
    ctx.translate(cx, pointerY);
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();

    if (glowColor) {
        const s = getSector(glowColor as SectorColor);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = s.neon;
        ctx.lineWidth = flash ? 4 : 2;
        ctx.shadowColor = s.neon;
        ctx.shadowBlur = flash ? 30 : 14;
        ctx.stroke();
        ctx.restore();
    }
}

export default function ColourPredictionSpinnerPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task7";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const spinStartRef = useRef<number>(0);
    const targetRotRef = useRef<number>(0);
    const currentRotRef = useRef<number>(0);
    const wheelRef = useRef<SectorColor[]>(buildWheel());

    const [gameState, setGameState] = useState<GameState>("idle");
    const [prediction, setPrediction] = useState<SectorColor | null>(null);
    const [result, setResult] = useState<SectorColor | null>(null);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [pointsGained, setPointsGained] = useState(0);
    const [timeLeft, setTimeLeft] = useState(PREDICTION_TIME);
    const [glowColor, setGlowColor] = useState<string | null>(null);
    const [flash, setFlash] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const CANVAS_SIZE = 280;

    const redraw = useCallback((rot: number, glow: string | null, fl: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawWheel(ctx, wheelRef.current, rot, CANVAS_SIZE, glow, fl);
    }, []);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            wheelRef.current = buildWheel();
            setGameState("idle");
            setPrediction(null);
            setResult(null);
            setScore(0);
            setStreak(0);
            setGlowColor(null);
            setFlash(false);
            currentRotRef.current = 0;
            if (timerRef.current) clearInterval(timerRef.current);
            if (flashRef.current) clearInterval(flashRef.current);
            cancelAnimationFrame(rafRef.current);
            // Wait for next tick to ensure canvas is ready
            setTimeout(() => redraw(0, null, false), 0);
        }
    }, [isOpen, redraw]);

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startPredictionTimer = () => {
        setTimeLeft(PREDICTION_TIME);
        stopTimer();
        timerRef.current = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    stopTimer();
                    triggerSpin(null);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    };

    const getResultColor = (finalRot: number): SectorColor => {
        const wheel = wheelRef.current;
        const total = wheel.length;
        const sliceAngle = (Math.PI * 2) / total;
        const normalized = (((-finalRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        const offset = (Math.PI / 2 + sliceAngle / 2 + normalized) % (Math.PI * 2);
        const idx = Math.floor(offset / sliceAngle) % total;
        return wheel[idx];
    };

    const triggerSpin = useCallback((pred: SectorColor | null) => {
        stopTimer();
        setGameState("spinning");

        const extraSpins = 5 + Math.floor(Math.random() * 3);
        const extraAngle = Math.random() * Math.PI * 2;
        const target = currentRotRef.current + extraSpins * Math.PI * 2 + extraAngle;
        targetRotRef.current = target;
        spinStartRef.current = performance.now();
        const startRot = currentRotRef.current;

        const animate = (now: number) => {
            const elapsed = now - spinStartRef.current;
            const progress = Math.min(elapsed / SPIN_DURATION, 1);
            const eased = easeOut(progress);
            const rot = startRot + (target - startRot) * eased;
            currentRotRef.current = rot;
            redraw(rot, null, false);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                currentRotRef.current = target;
                const landed = getResultColor(target);
                setResult(landed);

                const correct = pred !== null && pred === landed;
                const sector = getSector(landed);
                let pts = 0;
                if (correct) {
                    pts = sector.points + (streak + 1) * 5;
                    setScore((s) => s + pts);
                    setStreak((s) => s + 1);
                } else {
                    setStreak(0);
                }
                setPointsGained(pts);
                setGlowColor(landed);

                if (landed === "violet") {
                    let fl = true;
                    flashRef.current = setInterval(() => {
                        fl = !fl;
                        setFlash(fl);
                        redraw(target, landed, fl);
                    }, 200);
                    setTimeout(() => {
                        if (flashRef.current) clearInterval(flashRef.current);
                        setFlash(false);
                        redraw(target, landed, false);
                    }, 2000);
                } else {
                    redraw(target, landed, false);
                }

                setTimeout(() => setGameState("result"), 800);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
    }, [streak, redraw]);

    // mark completion when a successful result occurs
    useEffect(() => {
        if (gameState === "result" && pointsGained > 0) {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: pointsGained });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [gameState, pointsGained, completedTasks, localPlayerId, markTaskCompleted]);

    const handlePredict = (color: SectorColor) => {
        if (gameState !== "selecting") return;
        setPrediction(color);
    };

    const handleSpin = () => {
        if (gameState !== "selecting" || prediction === null) return;
        stopTimer();
        triggerSpin(prediction);
    };

    const handleStart = () => {
        wheelRef.current = buildWheel();
        setPrediction(null);
        setResult(null);
        setGlowColor(null);
        setFlash(false);
        setGameState("selecting");
        startPredictionTimer();
        redraw(currentRotRef.current, null, false);
    };

    const handleNext = () => {
        wheelRef.current = buildWheel();
        setPrediction(null);
        setResult(null);
        setGlowColor(null);
        setFlash(false);
        setGameState("selecting");
        startPredictionTimer();
        redraw(currentRotRef.current, null, false);
    };

    useEffect(() => {
        return () => {
            stopTimer();
            cancelAnimationFrame(rafRef.current);
            if (flashRef.current) clearInterval(flashRef.current);
        };
    }, []);

    if (!isOpen) return null;

    const timerPct = (timeLeft / PREDICTION_TIME) * 100;
    const timerColor = timerPct > 60 ? "#00ff9f" : timerPct > 30 ? "#ffd700" : "#ff3c5a";
    const isCorrect = result !== null && prediction !== null && result === prediction;

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
                background: "#07071a",
                borderRadius: 20,
                width: 380,
                fontFamily: "'Courier New', monospace",
                color: "#e0e0ff",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 60px #00f5ff14, 0 20px 80px #00000099",
                border: "1px solid rgba(0,245,255,0.1)",
            }}>
                {/* Close Button */}
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

                <style>{`
          @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          @keyframes violetFlare {
            0%{box-shadow:0 0 20px #bf5fff,0 0 60px #bf5fff44}
            50%{box-shadow:0 0 40px #bf5fff,0 0 100px #bf5fff88}
            100%{box-shadow:0 0 20px #bf5fff,0 0 60px #bf5fff44}
          }
          .cps-predict-btn {
            flex:1; padding:10px 8px; border-radius:10px; border:2px solid transparent;
            font-family:'Courier New',monospace; font-size:11px; font-weight:700;
            cursor:pointer; letter-spacing:2px; transition:all 0.2s; background:#ffffff08;
            color:#ffffff88;
          }
          .cps-predict-btn:hover { transform:translateY(-2px); }
          .cps-spin-btn {
            width:100%; padding:13px; border-radius:10px;
            font-family:'Courier New',monospace; font-size:13px; font-weight:700;
            cursor:pointer; letter-spacing:3px; transition:all 0.2s;
            border:1.5px solid #00f5ff88; color:#00f5ff;
            background:linear-gradient(135deg,#00f5ff14,#00ff9f14);
          }
          .cps-spin-btn:disabled { opacity:0.35; cursor:not-allowed; }
          .cps-spin-btn:not(:disabled):hover { background:linear-gradient(135deg,#00f5ff28,#00ff9f28); box-shadow:0 0 24px #00f5ff44; }
          .cps-next-btn {
            width:100%; padding:13px; border-radius:10px;
            font-family:'Courier New',monospace; font-size:13px; font-weight:700;
            cursor:pointer; letter-spacing:3px; transition:all 0.2s;
            background:linear-gradient(135deg,#00f5ff18,#00ff9f18);
            border:1.5px solid #00f5ff88; color:#00f5ff;
          }
          .cps-next-btn:hover { background:linear-gradient(135deg,#00f5ff30,#00ff9f30); box-shadow:0 0 24px #00f5ff44; }
        `}</style>

                {/* Grid bg */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                    <svg width="100%" height="100%" style={{ opacity: 0.05 }}>
                        <defs>
                            <pattern id="cps-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#00f5ff" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#cps-grid)" />
                    </svg>
                </div>

                <div style={{ position: "relative", zIndex: 1 }}>

                    {/* ── IDLE ── */}
                    {gameState === "idle" && (
                        <div style={{ padding: "52px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", animation: "fadeUp 0.4s ease" }}>
                            <div style={{ fontSize: 10, color: "#00f5ff88", letterSpacing: 5 }}>BLOCKCHAIN RANDOMNESS</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: "#00f5ff", letterSpacing: 2, textShadow: "0 0 28px #00f5ff", lineHeight: 1.3 }}>
                                COLOUR PREDICTION<br />SPINNER
                            </div>
                            <div style={{ fontSize: 12, color: "#ffffff55", lineHeight: 1.9, maxWidth: 280 }}>
                                Predict the outcome.<br />Mine your luck.
                            </div>

                            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                                {SECTORS.map((s) => (
                                    <div key={s.color} style={{ textAlign: "center" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, margin: "0 auto 6px", background: s.dim, border: `2px solid ${s.neon}`, boxShadow: `0 0 12px ${s.neon}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: s.neon, boxShadow: `0 0 8px ${s.neon}` }} />
                                        </div>
                                        <div style={{ fontSize: 9, color: s.neon, letterSpacing: 1 }}>{s.label}</div>
                                        <div style={{ fontSize: 9, color: "#ffffff33" }}>+{s.points}pts</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ fontSize: 10, color: "#bf5fff", letterSpacing: 1, background: "#bf5fff12", border: "1px solid #bf5fff33", padding: "6px 14px", borderRadius: 20 }}>
                                ✦ VIOLET is rare — 1 in 9 chance — pays +50
                            </div>

                            <button
                                className="cps-spin-btn"
                                style={{ marginTop: 8, maxWidth: 200 }}
                                onClick={handleStart}
                            >
                                START →
                            </button>
                        </div>
                    )}

                    {/* ── SELECTING / SPINNING / RESULT ── */}
                    {gameState !== "idle" && (
                        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>

                            {/* HUD */}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "#ffffff06", borderRadius: 10, border: "1px solid #ffffff0a" }}>
                                <div>
                                    <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2 }}>SCORE</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "#ffd700", textShadow: "0 0 10px #ffd70088" }}>{score}</div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2 }}>STREAK</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: streak > 0 ? "#00ff9f" : "#ffffff33", textShadow: streak > 0 ? "0 0 10px #00ff9f" : "none" }}>
                                        {streak > 0 ? `×${streak}` : "—"}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2 }}>VIOLET ODDS</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#bf5fff", textShadow: "0 0 8px #bf5fff" }}>1 in 9</div>
                                </div>
                            </div>

                            {/* Timer bar (selecting only) */}
                            {gameState === "selecting" && (
                                <div style={{ position: "relative" }}>
                                    <div style={{ height: 4, background: "#ffffff0a", borderRadius: 2, overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", width: `${timerPct}%`,
                                            background: timerColor, borderRadius: 2,
                                            transition: "width 1s linear, background 0.3s",
                                            boxShadow: `0 0 8px ${timerColor}`,
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 9, color: timerColor, textAlign: "right", marginTop: 3, letterSpacing: 1, animation: timeLeft <= 2 ? "pulse 0.5s infinite" : "none" }}>
                                        {timeLeft}s to predict
                                    </div>
                                </div>
                            )}

                            {/* Wheel */}
                            <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                                <div style={{
                                    borderRadius: "50%", padding: 4,
                                    background: "radial-gradient(circle, #0d0d2a, #07071a)",
                                    boxShadow: glowColor
                                        ? `0 0 40px ${getSector(glowColor as SectorColor).neon}66, 0 0 80px ${getSector(glowColor as SectorColor).neon}22`
                                        : "0 0 30px #00f5ff18",
                                    transition: "box-shadow 0.5s",
                                    animation: result === "violet" ? "violetFlare 0.4s infinite" : "none",
                                }}>
                                    <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ display: "block" }} />
                                </div>
                            </div>

                            {/* Prediction buttons */}
                            {(gameState === "selecting" || gameState === "spinning") && (
                                <div>
                                    <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 3, textAlign: "center", marginBottom: 8 }}>
                                        {gameState === "selecting" ? "CHOOSE YOUR PREDICTION" : "SPINNING..."}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {SECTORS.map((s) => {
                                            const sel = prediction === s.color;
                                            return (
                                                <button
                                                    key={s.color}
                                                    className="cps-predict-btn"
                                                    disabled={gameState === "spinning"}
                                                    onClick={() => handlePredict(s.color)}
                                                    style={{
                                                        borderColor: sel ? s.neon : "transparent",
                                                        background: sel ? `${s.neon}18` : "#ffffff06",
                                                        color: sel ? s.neon : "#ffffff55",
                                                        boxShadow: sel ? `0 0 16px ${s.neon}44` : "none",
                                                        transform: sel ? "translateY(-2px)" : "none",
                                                    }}
                                                >
                                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.neon, margin: "0 auto 5px", boxShadow: `0 0 6px ${s.neon}` }} />
                                                    {s.label}
                                                    <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>+{s.points}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Spin button */}
                            {gameState === "selecting" && (
                                <button
                                    className="cps-spin-btn"
                                    disabled={prediction === null}
                                    onClick={handleSpin}
                                >
                                    {prediction ? "SPIN THE BLOCK →" : "SELECT A COLOUR FIRST"}
                                </button>
                            )}

                            {/* Result panel */}
                            {gameState === "result" && result && (
                                <div style={{ animation: "fadeUp 0.35s ease", display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{
                                        borderRadius: 12, padding: "16px",
                                        background: isCorrect ? "#00ff9f0d" : "#ff3c5a0d",
                                        border: `1.5px solid ${isCorrect ? "#00ff9f33" : "#ff3c5a33"}`,
                                        textAlign: "center",
                                    }}>
                                        <div style={{
                                            fontSize: 16, fontWeight: 700, letterSpacing: 2, marginBottom: 8,
                                            color: isCorrect ? "#00ff9f" : "#ff3c5a",
                                            textShadow: `0 0 16px ${isCorrect ? "#00ff9f" : "#ff3c5a"}`,
                                        }}>
                                            {isCorrect ? "✓ BLOCK CONFIRMED" : prediction === null ? "⏱ TIME EXPIRED" : "✗ PREDICTION FAILED"}
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 10 }}>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2, marginBottom: 4 }}>YOU PREDICTED</div>
                                                <div style={{
                                                    fontSize: 12, fontWeight: 700, letterSpacing: 1,
                                                    color: prediction ? getSector(prediction).neon : "#ffffff44",
                                                    textShadow: prediction ? `0 0 10px ${getSector(prediction).neon}` : "none",
                                                    padding: "4px 12px", borderRadius: 6,
                                                    background: prediction ? `${getSector(prediction).neon}14` : "#ffffff08",
                                                    border: `1px solid ${prediction ? getSector(prediction).neon + "44" : "#ffffff14"}`,
                                                }}>
                                                    {prediction ? getSector(prediction).label : "NONE"}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2, marginBottom: 4 }}>LANDED ON</div>
                                                <div style={{
                                                    fontSize: 12, fontWeight: 700, letterSpacing: 1,
                                                    color: getSector(result).neon,
                                                    textShadow: `0 0 10px ${getSector(result).neon}`,
                                                    padding: "4px 12px", borderRadius: 6,
                                                    background: `${getSector(result).neon}14`,
                                                    border: `1px solid ${getSector(result).neon}44`,
                                                }}>
                                                    {getSector(result).label}
                                                </div>
                                            </div>
                                        </div>

                                        {isCorrect && (
                                            <div style={{ fontSize: 13, color: "#ffd700", fontWeight: 700, textShadow: "0 0 10px #ffd700" }}>
                                                +{pointsGained} pts {streak > 1 ? `(×${streak} streak bonus!)` : ""}
                                            </div>
                                        )}

                                        {result === "violet" && (
                                            <div style={{ fontSize: 10, color: "#bf5fff", marginTop: 6, letterSpacing: 1, animation: "pulse 1s infinite" }}>
                                                ✦ RARE VIOLET HIT ✦
                                            </div>
                                        )}
                                    </div>

                                    <button className="cps-next-btn" onClick={handleNext}>
                                        NEXT ROUND →
                                    </button>
                                </div>
                            )}

                            {/* Spinning indicator */}
                            {gameState === "spinning" && (
                                <div style={{ textAlign: "center", fontSize: 11, color: "#00f5ff66", letterSpacing: 3, animation: "pulse 0.8s infinite" }}>
                                    ◉ MINING RANDOMNESS...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
