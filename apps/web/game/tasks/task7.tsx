import React, { useState, useRef, useEffect, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GameState = "idle" | "ready" | "spinning" | "result";

interface Symbol {
    id: string;
    label: string;
    weight: number;
    multiplier: number;
}

const SYMBOLS: Symbol[] = [
    { id: "jackpot", label: "7️⃣", weight: 114, multiplier: 30 }, // ~1/679 chance for 7-7-7
    { id: "diamond", label: "💎", weight: 156, multiplier: 15 },
    { id: "bell", label: "🔔", weight: 200, multiplier: 10 },
    { id: "grapes", label: "🍇", weight: 265, multiplier: 5 },
    { id: "cherry", label: "🍒", weight: 265, multiplier: 5 },
];

function getRandomSymbol(): Symbol {
    const total = 1000;
    const rand = Math.floor(Math.random() * total);
    let acc = 0;
    for (const s of SYMBOLS) {
        acc += s.weight;
        if (rand < acc) return s;
    }
    return SYMBOLS[0];
}

export default function AdvancedSlotMachinePopup({ isOpen, onClose }) {
    const TASK_ID = "task7";
    const { completedTasks, localPlayerId, markTaskCompleted, role } = useGameStore();

    const [gameState, setGameState] = useState<GameState>("idle");
    const [reels, setReels] = useState<[Symbol, Symbol, Symbol]>([SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]]);
    const [leverPos, setLeverPos] = useState(0); // 0 = up, 1 = down
    const [pointsWon, setPointsWon] = useState(0);
    const [isBigWin, setIsBigWin] = useState(false);
    const [spinningReels, setSpinningReels] = useState([false, false, false]);

    const isDragging = useRef(false);
    const dragStartY = useRef(0);

    const isImposter = role === "IMPOSTER";
    const themeColor = isImposter ? "#a855f7" : "#3b82f6";
    const title = isImposter ? "SABOTAGE SLOTS" : "NEON SLOT MACHINE";

    // Trigger spin when lever is pulled down
    const handleSpin = useCallback(() => {
        if (gameState === "spinning") return;
        setGameState("spinning");
        setIsBigWin(false);
        setSpinningReels([true, true, true]);

        // Determine result immediately
        const r1 = getRandomSymbol();
        const r2 = getRandomSymbol();
        const r3 = getRandomSymbol();

        // Sequential stopping for visual effect
        setTimeout(() => setSpinningReels([false, true, true]), 1200);
        setTimeout(() => setSpinningReels([false, false, true]), 1800);
        setTimeout(() => {
            setSpinningReels([false, false, false]);
            setReels([r1, r2, r3]);

            let won = 1; // Baseline progress
            if (r1.id === r2.id && r2.id === r3.id) {
                won = r1.multiplier;
                if (r1.id === "jackpot") setIsBigWin(true);
            } else if (r1.id === r2.id || r2.id === r3.id || r1.id === r3.id) {
                won = 2; // Pair bonus
            }

            setPointsWon(won);
            markTaskCompleted(TASK_ID);
            socket.emit("task_completed", {
                taskId: TASK_ID,
                playerSocketId: localPlayerId,
                points: won,
            });
            setGameState("result");
        }, 2400);
    }, [gameState, localPlayerId, markTaskCompleted]);

    // Lever dragging logic
    const onMouseDown = (e: React.MouseEvent) => {
        if (gameState === "spinning") return;
        isDragging.current = true;
        dragStartY.current = e.clientY;
    };

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = e.clientY - dragStartY.current;
        const pos = Math.max(0, Math.min(1, delta / 100)); // 100px travel
        setLeverPos(pos);
        if (pos > 0.9 && gameState !== "spinning") {
            isDragging.current = false;
            handleSpin();
            // Snap back lever after a delay
            setTimeout(() => setLeverPos(0), 300);
        }
    }, [gameState, handleSpin]);

    const onMouseUp = useCallback(() => {
        isDragging.current = false;
        if (leverPos < 0.9) setLeverPos(0);
    }, [leverPos]);

    useEffect(() => {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={{ ...machineStyle, borderColor: isBigWin ? "#ffd700" : (themeColor + "44") }}>
                <button style={closeBtn} onClick={onClose}>×</button>

                <div style={{ fontSize: 10, color: themeColor, letterSpacing: 5, marginBottom: 10 }}>
                    {isImposter ? "SYSTEM MALFUNCTION" : "QUANTUM PROBABILITY"}
                </div>
                <h2 style={{ ...titleStyle, color: isBigWin ? "#ffd700" : "white" }}>
                    {isBigWin ? "🎰 JACKPOT 🎰" : title}
                </h2>

                <div style={mainLayout}>
                    {/* The Reels */}
                    <div style={reelsContainer}>
                        {[0, 1, 2].map((i) => (
                            <div key={i} style={reelBox}>
                                <div style={{
                                    ...reelStrip,
                                    animation: spinningReels[i] ? "reelScroll 0.2s linear infinite" : "none",
                                    filter: spinningReels[i] ? "blur(4px)" : "none"
                                }}>
                                    {spinningReels[i] ? (
                                        // Random symbols during spin
                                        [...SYMBOLS, ...SYMBOLS].map((s, idx) => (
                                            <div key={idx} style={symbolStyle}>{s.label}</div>
                                        ))
                                    ) : (
                                        <div style={symbolStyle}>{reels[i].label}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* The Lever */}
                    <div style={leverArea}>
                        <div style={leverBase}>
                            <div
                                onMouseDown={onMouseDown}
                                style={{
                                    ...leverStick,
                                    height: 80 - (leverPos * 40),
                                    transform: `rotate(${leverPos * 20}deg)`,
                                    top: 20 + (leverPos * 60)
                                }}
                            >
                                <div style={{ ...leverBall, background: isDragging.current ? "#ff3c5a" : themeColor }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Result Message */}
                <div style={resultArea}>
                    {gameState === "result" ? (
                        <div style={{ animation: "fadeUp 0.3s ease" }}>
                            <div style={{ color: pointsWon > 2 ? "#ffd700" : "white/60", fontSize: 14 }}>
                                {pointsWon === 30 ? "🔥 GRAND JACKPOT! 🔥" : pointsWon > 2 ? "✨ BIG WIN! ✨" : "MATCHED PROGRESS"}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: "bold", color: "white" }}>+{pointsWon}%</div>
                            <div style={{ fontSize: 10, color: "white/40", marginTop: 5 }}>PULL LEVER TO SPIN AGAIN</div>
                        </div>
                    ) : (
                        <div style={{ color: "white/40", letterSpacing: 2 }}>{gameState === "spinning" ? "SPINNING..." : "PULL LEVER TO START"}</div>
                    )}
                </div>

                <style>{`
                    @keyframes reelScroll {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(-600px); } /* 5 symbols * 120px */
                    }
                    @keyframes fadeUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(5px)",
};

const machineStyle: React.CSSProperties = {
    background: "#0a0a1a",
    padding: "40px 60px",
    borderRadius: "30px",
    width: 500,
    textAlign: "center" as const,
    fontFamily: "'Courier New', monospace",
    border: "2px solid",
    boxShadow: "0 0 50px rgba(0,0,0,0.5)",
    position: "relative",
};

const titleStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 4,
    marginBottom: 30,
};

const mainLayout: React.CSSProperties = {
    display: "flex",
    gap: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
};

const reelsContainer: React.CSSProperties = {
    display: "flex",
    gap: 15,
    background: "#050510",
    padding: 15,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.1)",
};

const reelBox: React.CSSProperties = {
    width: 90,
    height: 120,
    background: "linear-gradient(to bottom, #111, #222, #111)",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
};

const reelStrip: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.5s ease-out",
};

const symbolStyle: React.CSSProperties = {
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 50,
};

const leverArea: React.CSSProperties = {
    position: "relative",
    width: 40,
    height: 200,
};

const leverBase: React.CSSProperties = {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: 30,
    height: 60,
    background: "#111",
    borderRadius: "15px 15px 5px 5px",
    border: "1px solid rgba(255,255,255,0.1)",
};

const leverStick: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transformOrigin: "bottom center",
    width: 8,
    background: "linear-gradient(to right, #444, #888, #444)",
    borderRadius: 4,
    cursor: "grab",
    transition: "height 0.1s linear, top 0.1s linear, transform 0.1s linear",
};

const leverBall: React.CSSProperties = {
    position: "absolute",
    top: -20,
    left: -11,
    width: 30,
    height: 30,
    borderRadius: "50%",
    boxShadow: "0 0 15px rgba(0,0,0,0.5)",
};

const resultArea: React.CSSProperties = {
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 15,
};

const closeBtn: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 20,
    color: "#fff",
    cursor: "pointer",
    width: 36,
    height: 36,
    borderRadius: "50%",
};