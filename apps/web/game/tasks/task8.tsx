import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Color = "Red" | "Green" | "Violet";
type Phase = "select" | "countdown" | "spinning" | "result";

interface RoundResult {
    color: Color;
    won: boolean;
    points: number;
    streakBonus: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTDOWN_SEC = 7;
const SPIN_DURATION_MS = 3600;

// The pointer sits at the TOP of the wheel (12 o'clock = 0°).
// Sectors are drawn clockwise starting at 0°.
// Sector i occupies angular range [i * SECTOR_DEG, (i+1) * SECTOR_DEG].
// To land sector i under the top pointer we rotate the wheel so that the
// MIDPOINT of sector i aligns with 0°.
//   needed clockwise rotation = (360 - sectorMid) mod 360

const SECTORS: { color: Color; fill: string; darkFill: string }[] = [
    { color: "Red", fill: "#ef4444", darkFill: "#b91c1c" },
    { color: "Green", fill: "#22c55e", darkFill: "#15803d" },
    { color: "Red", fill: "#ef4444", darkFill: "#b91c1c" },
    { color: "Green", fill: "#22c55e", darkFill: "#15803d" },
    { color: "Violet", fill: "#a855f7", darkFill: "#7e22ce" },
    { color: "Red", fill: "#ef4444", darkFill: "#b91c1c" },
    { color: "Green", fill: "#22c55e", darkFill: "#15803d" },
    { color: "Red", fill: "#ef4444", darkFill: "#b91c1c" },
    { color: "Green", fill: "#22c55e", darkFill: "#15803d" },
    { color: "Red", fill: "#ef4444", darkFill: "#b91c1c" },
];

const N = SECTORS.length;
const SECTOR_DEG = 360 / N; // 36° each

const REWARD: Record<Color, number> = { Red: 10, Green: 10, Violet: 50 };
const STREAK_BONUS = 15;
const STREAK_THRESHOLD = 3;

// ─── Sound (placeholder) ──────────────────────────────────────────────────────

function playSound(_type: "tick" | "spin" | "win" | "lose" | "jackpot") {
    // Wire up Web Audio API or Howler.js here
}

// ─── Weighted random sector pick ──────────────────────────────────────────────
// Returns a random sector INDEX (not just a color) so the wheel lands correctly.

function weightedPickIndex(): number {
    const r = Math.random();
    let targetColor: Color;
    if (r < 0.45) targetColor = "Red";
    else if (r < 0.90) targetColor = "Green";
    else targetColor = "Violet";

    const matching = SECTORS
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.color === targetColor);

    return matching[Math.floor(Math.random() * matching.length)].i;
}

// ─── Rotation calculator ──────────────────────────────────────────────────────
// Given the wheel's current accumulated rotation and the desired landing sector,
// returns the new rotation that visually lands that sector under the pointer
// after 5+ full dramatic spins.

function calcNextRotation(currentDeg: number, targetIndex: number): number {
    // Mid-angle of target sector in the wheel's own frame (0° = top)
    const sectorMid = targetIndex * SECTOR_DEG + SECTOR_DEG / 2;

    // Clockwise rotation needed to bring sectorMid to the top
    const alignDeg = (360 - sectorMid + 360) % 360;

    // Delta from where we currently are (normalised)
    const currentNorm = ((currentDeg % 360) + 360) % 360;
    let delta = (alignDeg - currentNorm + 360) % 360;
    if (delta < 10) delta += 360; // guarantee at least one rotation

    // 5 extra full spins for drama
    return currentDeg + 5 * 360 + delta;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function polarXY(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
    const s = polarXY(cx, cy, r, startDeg);
    const e = polarXY(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`;
}

// ─── Wheel SVG component ──────────────────────────────────────────────────────

interface WheelProps {
    rotateDeg: number;
    animating: boolean;
    highlightIndex: number | null;
}

function SpinWheel({ rotateDeg, animating, highlightIndex }: WheelProps) {
    const CX = 120, CY = 120, R = 110;

    return (
        <div style={{
            width: 240, height: 240,
            transform: `rotate(${rotateDeg}deg)`,
            transition: animating
                ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.1, 1)`
                : "none",
            willChange: "transform",
            borderRadius: "50%",
            boxShadow: "0 0 40px rgba(168,85,247,0.25), 0 6px 36px rgba(0,0,0,0.8)",
        }}>
            <svg width={240} height={240} viewBox="0 0 240 240">
                <defs>
                    <filter id="labelGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {SECTORS.map((sec, i) => {
                    const startDeg = i * SECTOR_DEG;
                    const endDeg = startDeg + SECTOR_DEG;
                    const midDeg = startDeg + SECTOR_DEG / 2;
                    const isLit = highlightIndex === i;
                    const lp = polarXY(CX, CY, R * 0.65, midDeg);

                    return (
                        <g key={i}>
                            <path
                                d={arcPath(CX, CY, R, startDeg, endDeg)}
                                fill={isLit ? sec.fill : sec.darkFill}
                                stroke="#08081a"
                                strokeWidth={1.5}
                                style={{ transition: "fill 0.5s ease" }}
                            />
                            <text
                                x={lp.x} y={lp.y}
                                textAnchor="middle" dominantBaseline="middle"
                                fill="white"
                                fontSize={sec.color === "Violet" ? 8.5 : 8}
                                fontWeight="900"
                                fontFamily="'Courier New', monospace"
                                letterSpacing="0.5"
                                transform={`rotate(${midDeg}, ${lp.x}, ${lp.y})`}
                                style={{ filter: "url(#labelGlow)", userSelect: "none" }}
                            >
                                {sec.color === "Violet" ? "★VIO" : sec.color.slice(0, 3).toUpperCase()}
                            </text>
                        </g>
                    );
                })}

                {/* Outer rim */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
                {/* Inner ring accent */}
                <circle cx={CX} cy={CY} r={R * 0.38} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

                {/* Center hub */}
                <circle cx={CX} cy={CY} r={20} fill="#0d0d1f" stroke="#a855f7" strokeWidth={2} />
                <circle cx={CX} cy={CY} r={8} fill="#a855f7" />
                <circle cx={CX} cy={CY} r={3} fill="#e9d5ff" />
            </svg>
        </div>
    );
}

// ─── Pointer ──────────────────────────────────────────────────────────────────

function Pointer() {
    return (
        <div style={{
            position: "absolute", top: -20, left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "13px solid transparent",
            borderRight: "13px solid transparent",
            borderTop: "28px solid #a855f7",
            filter: "drop-shadow(0 0 8px #a855f7) drop-shadow(0 0 18px rgba(168,85,247,0.6))",
            zIndex: 10,
        }} />
    );
}

// ─── Bet button ───────────────────────────────────────────────────────────────

interface BetButtonProps {
    color: Color;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}

const BET_META: Record<Color, { bg: string; border: string; glow: string; icon: string; reward: string }> = {
    Red: { bg: "#450a0a", border: "#ef4444", glow: "rgba(239,68,68,0.45)", icon: "🔴", reward: "+10 pts" },
    Green: { bg: "#052e16", border: "#22c55e", glow: "rgba(34,197,94,0.45)", icon: "🟢", reward: "+10 pts" },
    Violet: { bg: "#2e1065", border: "#a855f7", glow: "rgba(168,85,247,0.55)", icon: "💜", reward: "+50 pts ★" },
};

function BetButton({ color, selected, disabled, onClick }: BetButtonProps) {
    const m = BET_META[color];
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: selected
                    ? `radial-gradient(circle at 60% 40%, ${m.border}22, ${m.bg})`
                    : m.bg,
                border: `2px solid ${selected ? m.border : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14,
                color: "white",
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
                fontSize: 13,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled && !selected ? 0.4 : 1,
                padding: "10px 14px",
                minWidth: 90,
                textAlign: "center" as const,
                boxShadow: selected ? `0 0 18px ${m.glow}, 0 0 36px ${m.glow}` : "none",
                transform: selected ? "scale(1.06) translateY(-2px)" : "scale(1)",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: 4,
            }}
        >
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            <span style={{ letterSpacing: "0.08em", fontSize: 11 }}>{color.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: selected ? m.border : "#6b7280", fontWeight: 800, letterSpacing: "0.05em" }}>
                {m.reward}
            </span>
        </button>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
    label: string; value: string | number; sub?: string; accent?: string;
}) {
    return (
        <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "10px 12px",
            textAlign: "center",
            minWidth: 75,
        }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.18em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: accent ?? "#e2e8f0" }}>{value}</div>
            {sub && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ─── History pill ─────────────────────────────────────────────────────────────

function HistoryPill({ result }: { result: RoundResult }) {
    const col = result.color === "Red" ? "#ef4444" : result.color === "Green" ? "#22c55e" : "#a855f7";
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: result.won ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
            border: `1px solid ${result.won ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.12)"}`,
            borderRadius: 8, padding: "4px 10px", fontSize: 11,
            fontFamily: "'Courier New', monospace", color: "#9ca3af", flexShrink: 0,
        }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} />
            <span style={{ color: col, fontWeight: 700 }}>{result.color.slice(0, 3).toUpperCase()}</span>
            <span style={{ color: result.won ? "#4ade80" : "#f87171" }}>
                {result.won ? `+${result.points + result.streakBonus}` : "✗"}
            </span>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ColorSpinPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ColorSpinPopup({ isOpen, onClose }: ColorSpinPopupProps) {

    // ── UI state
    const [phase, setPhase] = useState<Phase>("select");
    const [selected, setSelected] = useState<Color | null>(null);
    const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
    const [rotateDeg, setRotateDeg] = useState(0);
    const [animating, setAnimating] = useState(false);
    const [resultIndex, setResultIndex] = useState<number | null>(null);
    const [lastResult, setLastResult] = useState<RoundResult | null>(null);

    // ── Score state
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [history, setHistory] = useState<RoundResult[]>([]);

    // ── Mutable refs (avoids stale closure bugs in timers)
    const rotateDegRef = useRef(0);
    const selectedRef = useRef<Color | null>(null);
    const streakRef = useRef(0);
    const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep refs in sync with state
    useEffect(() => { rotateDegRef.current = rotateDeg; }, [rotateDeg]);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { streakRef.current = streak; }, [streak]);

    // Cleanup timers on unmount
    useEffect(() => () => {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        if (spinTimer.current) clearTimeout(spinTimer.current);
    }, []);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setPhase("select");
            setSelected(null);
            selectedRef.current = null;
            setCountdown(COUNTDOWN_SEC);
            setResultIndex(null);
            setLastResult(null);
            setAnimating(false);
            // We don't necessarily want to reset score/streak/history every time it opens, 
            // but if we do, we'd do it here. Keeping it for persistent session.
        }
    }, [isOpen]);

    // ── Core spin executor — reads current values from refs, never stale
    const executeSpin = useCallback(() => {
        const targetIndex = weightedPickIndex();
        const targetColor = SECTORS[targetIndex].color;
        const nextDeg = calcNextRotation(rotateDegRef.current, targetIndex);

        playSound("spin");

        // Update rotation immediately so CSS transition fires
        rotateDegRef.current = nextDeg;
        setRotateDeg(nextDeg);
        setAnimating(true);
        setPhase("spinning");

        spinTimer.current = setTimeout(() => {
            setAnimating(false);
            setResultIndex(targetIndex);

            const betColor = selectedRef.current;
            const won = betColor === targetColor;
            const base = won ? REWARD[targetColor] : 0;
            const prevStreak = streakRef.current;
            const newStreak = won ? prevStreak + 1 : 0;
            const bonus = won && newStreak >= STREAK_THRESHOLD ? STREAK_BONUS : 0;
            const total = base + bonus;

            const result: RoundResult = { color: targetColor, won, points: base, streakBonus: bonus };

            streakRef.current = newStreak;
            setStreak(newStreak);
            setBestStreak(bs => Math.max(bs, newStreak));
            setScore(s => s + total);
            setHistory(h => [result, ...h].slice(0, 10));
            setLastResult(result);
            setPhase("result");

            playSound(won ? (targetColor === "Violet" ? "jackpot" : "win") : "lose");
        }, SPIN_DURATION_MS + 400);
    }, []);

    // ── Countdown starter
    const startCountdown = useCallback(() => {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        setCountdown(COUNTDOWN_SEC);
        setPhase("countdown");

        let remaining = COUNTDOWN_SEC;
        countdownTimer.current = setInterval(() => {
            remaining -= 1;
            playSound("tick");
            setCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(countdownTimer.current!);
                executeSpin();
            }
        }, 1000);
    }, [executeSpin]);

    // ── User picks a color
    const handlePick = useCallback((color: Color) => {
        setSelected(color);
        selectedRef.current = color;

        setPhase(prev => {
            if (prev === "spinning") return prev; // ignore during spin

            if (prev === "select" || prev === "result") {
                // Clear any previous timers
                if (countdownTimer.current) clearInterval(countdownTimer.current);
                if (spinTimer.current) clearTimeout(spinTimer.current);
                setResultIndex(null);
                setLastResult(null);
                // Start countdown after state flush
                setTimeout(startCountdown, 0);
            }
            // During countdown: just swap the selected color, spin will read from ref
            return prev === "result" ? "countdown" : prev;
        });
    }, [startCountdown]);

    // ── Reset / change bet
    const handleReset = useCallback(() => {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        if (spinTimer.current) clearTimeout(spinTimer.current);
        setPhase("select");
        setSelected(null);
        selectedRef.current = null;
        setCountdown(COUNTDOWN_SEC);
        setResultIndex(null);
        setLastResult(null);
        setAnimating(false);
    }, []);

    // ── Derived values
    const countdownPct = (countdown / COUNTDOWN_SEC) * 100;
    const won = lastResult?.won ?? false;
    const resultSector = resultIndex !== null ? SECTORS[resultIndex] : null;

    const getMessage = (): { text: string; color: string } => {
        if (phase === "select") return { text: "Choose a color below to start the countdown!", color: "#9ca3af" };
        if (phase === "countdown") return { text: selected ? `You picked ${selected} — change anytime before spin!` : "⚠️ Pick a color before the wheel spins!", color: "#c4b5fd" };
        if (phase === "spinning") return { text: "🎰 The wheel decides your fate...", color: "#fbbf24" };
        if (!lastResult) return { text: "", color: "" };
        const bonus = lastResult.streakBonus > 0 ? ` (incl. +${lastResult.streakBonus} streak bonus)` : "";
        const total = lastResult.points + lastResult.streakBonus;
        if (won && lastResult.color === "Violet") return { text: `🌟 JACKPOT! Violet! +${total} pts${bonus}`, color: "#d8b4fe" };
        if (won) return { text: `✅ Correct! ${lastResult.color} wins! +${total} pts${bonus}`, color: "#4ade80" };
        return { text: selected ? `❌ Result: ${lastResult.color}. You picked ${selected}. Better luck next time!` : `Result: ${lastResult.color}. No bet placed.`, color: "#f87171" };
    };

    const msg = getMessage();

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
        }}>
            <div style={{
                background: "radial-gradient(ellipse 80% 55% at 50% -5%, #1e0a35 0%, #0d0d1f 55%, #000 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px",
                fontFamily: "'Courier New', Courier, monospace",
                color: "white",
                borderRadius: 20,
                position: "relative",
                maxWidth: 400,
                width: "95%",
                border: "1px solid rgba(168,85,247,0.3)",
                boxShadow: "0 0 60px rgba(168,85,247,0.15), 0 20px 80px rgba(0,0,0,0.9)",
                overflow: "hidden",
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(168,85,247,0.4)",
                        color: "#a855f7",
                        borderRadius: "50%",
                        width: "36px",
                        height: "36px",
                        cursor: "pointer",
                        zIndex: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(168,85,247,0.2)";
                        e.currentTarget.style.borderColor = "#a855f7";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.5)";
                        e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)";
                    }}
                >
                    ✕
                </button>

                {/* Title */}
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: "clamp(18px, 5vw, 24px)",
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        background: "linear-gradient(90deg, #ef4444 0%, #a855f7 50%, #22c55e 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}>
                        COLOR SPIN
                    </h1>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 15 }}>
                    <StatCard label="SCORE" value={score} accent="#a855f7" />
                    <StatCard
                        label="STREAK" value={`${streak}🔥`}
                        accent={streak >= STREAK_THRESHOLD ? "#4ade80" : "#f59e0b"}
                    />
                    <StatCard label="BEST" value={bestStreak} accent="#38bdf8" />
                </div>

                {/* Wheel */}
                <div style={{ position: "relative", marginBottom: 12 }}>
                    <Pointer />
                    <SpinWheel rotateDeg={rotateDeg} animating={animating} highlightIndex={resultIndex} />

                    {/* Result badge */}
                    {phase === "result" && resultSector && (
                        <div style={{
                            position: "absolute", bottom: -18, left: "50%",
                            transform: "translateX(-50%)",
                            background: resultSector.darkFill,
                            border: `2px solid ${resultSector.fill}`,
                            borderRadius: 99, padding: "5px 20px",
                            fontSize: 13, fontWeight: 800, color: "white",
                            letterSpacing: "0.12em", whiteSpace: "nowrap",
                            boxShadow: `0 0 18px ${resultSector.fill}88`,
                        }}>
                            {lastResult?.color.toUpperCase()}{lastResult?.color === "Violet" && " ★"}
                        </div>
                    )}
                </div>

                {/* Countdown bar */}
                <div style={{ width: 280, marginBottom: 8, minHeight: 30 }}>
                    {phase === "countdown" && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7280", marginBottom: 5 }}>
                                <span style={{ letterSpacing: "0.15em" }}>AUTO-SPIN IN</span>
                                <span style={{ fontWeight: 800, fontSize: 13, color: countdown <= 2 ? "#ef4444" : "#a855f7" }}>
                                    {countdown}s
                                </span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", width: `${countdownPct}%`,
                                    background: countdown <= 2
                                        ? "linear-gradient(90deg, #ef4444, #dc2626)"
                                        : "linear-gradient(90deg, #7c3aed, #a855f7)",
                                    borderRadius: 99,
                                    transition: "width 1s linear, background 0.4s ease",
                                }} />
                            </div>
                        </>
                    )}
                </div>

                {/* Status message */}
                <div style={{
                    background: phase === "result"
                        ? (won ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)")
                        : "rgba(168,85,247,0.07)",
                    border: `1px solid ${phase === "result" ? (won ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.18)") : "rgba(168,85,247,0.18)"}`,
                    borderRadius: 12, padding: "8px 16px", marginBottom: 10,
                    fontSize: 12, fontWeight: 600, color: msg.color,
                    textAlign: "center", maxWidth: 360, letterSpacing: "0.03em",
                    minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    {msg.text}
                </div>

                {/* Bet buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 15 }}>
                    {(["Red", "Green", "Violet"] as Color[]).map(c => (
                        <BetButton
                            key={c} color={c}
                            selected={selected === c}
                            disabled={phase === "spinning"}
                            onClick={() => handlePick(c)}
                        />
                    ))}
                </div>

                {/* Probability Hint */}
                <div style={{ marginTop: 8, fontSize: 9, color: "#4b5563", letterSpacing: "0.1em" }}>
                    VIOLET: 10% (5X PAYOUT)
                </div>
            </div>
        </div>
    );
}
