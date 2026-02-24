import { useState, useEffect, useRef } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GameState = "idle" | "playing" | "feedback" | "gameOver";

interface Question {
    id: number;
    scenario: string;
    bugLine: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    emoji: string;
}

const QUESTIONS: Question[] = [
    {
        id: 1,
        emoji: "🔑",
        scenario: "You wrote a contract that checks if someone is the owner.",
        bugLine: `if (owner = msg.sender)`,
        question: "What's wrong with this line?",
        options: [
            "= sets a value, but we need == to compare",
            "msg.sender should come first",
            "owner is spelled wrong",
            "Nothing is wrong",
        ],
        correctIndex: 0,
        explanation: "= is used to assign (store) a value. == is used to compare two things. We want to check if owner equals msg.sender, so we need ==.",
    },
    {
        id: 2,
        emoji: "💰",
        scenario: "A user wants to withdraw money from their account.",
        bugLine: `require(amount > balance)`,
        question: "What does this check do wrong?",
        options: [
            "It checks the wrong variable",
            "It allows withdrawing MORE than the balance",
            "It uses the wrong function name",
            "require() is not allowed here",
        ],
        correctIndex: 1,
        explanation: "We want to make sure you have ENOUGH money. The check should be balance >= amount. This bug would let people take out more than they have!",
    },
    {
        id: 3,
        emoji: "🚪",
        scenario: "You have a function that changes who the admin is.",
        bugLine: `function setAdmin(address _admin) { ... }`,
        question: "What's the problem?",
        options: [
            "The function name is too long",
            "address is the wrong type",
            "Anyone can call this — there's no access control",
            "The parameter name needs to change",
        ],
        correctIndex: 2,
        explanation: "If anyone can call setAdmin(), then anyone can make themselves the admin and take over the contract! We need to restrict who can call it.",
    },
];

const TOTAL_TIME = 20;

export default function SmartContractQuickFixPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task6";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    const [gameState, setGameState] = useState<GameState>("idle");
    const [questionIndex, setQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const [shuffled, setShuffled] = useState<Question[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setGameState("idle");
            setQuestionIndex(0);
            setScore(0);
            setSelected(null);
            setTimeLeft(TOTAL_TIME);
            setShuffled([]);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isOpen]);

    const current = shuffled[questionIndex];
    const timerPct = (timeLeft / TOTAL_TIME) * 100;
    const timerColor = timerPct > 50 ? "#00ff9f" : timerPct > 25 ? "#ffd700" : "#ff3c5a";

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startTimer = () => {
        stopTimer();
        timerRef.current = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    stopTimer();
                    setSelected(-1);
                    setGameState("feedback");
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        if (gameState === "playing") startTimer();
        return stopTimer;
    }, [gameState, questionIndex]);

    useEffect(() => () => stopTimer(), []);

    // mark completion when quiz ends
    useEffect(() => {
        if (gameState === "gameOver") {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [gameState, completedTasks, localPlayerId, markTaskCompleted]);

    const startGame = () => {
        const s = [...QUESTIONS].sort(() => Math.random() - 0.5);
        setShuffled(s);
        setQuestionIndex(0);
        setScore(0);
        setSelected(null);
        setTimeLeft(TOTAL_TIME);
        setGameState("playing");
    };

    const handleSelect = (idx: number) => {
        if (gameState !== "playing") return;
        stopTimer();
        setSelected(idx);
        if (idx === current.correctIndex) setScore((s) => s + 1);
        setGameState("feedback");
    };

    const handleNext = () => {
        if (questionIndex + 1 >= shuffled.length) {
            setGameState("gameOver");
        } else {
            setQuestionIndex((i) => i + 1);
            setSelected(null);
            setTimeLeft(TOTAL_TIME);
            setGameState("playing");
        }
    };

    const optionStyle = (idx: number): React.CSSProperties => {
        const base: React.CSSProperties = {
            width: "100%", padding: "12px 16px", borderRadius: 10,
            fontFamily: "'Courier New', monospace", fontSize: 13, textAlign: "left",
            transition: "all 0.2s", border: "1.5px solid #ffffff14",
            background: "#ffffff06", color: "#c8d8ff", lineHeight: 1.5,
            cursor: gameState === "playing" ? "pointer" : "default",
        };
        if (gameState !== "feedback") return base;
        if (idx === current.correctIndex) return { ...base, background: "#00ff9f14", border: "1.5px solid #00ff9f66", color: "#00ff9f" };
        if (idx === selected && idx !== current.correctIndex) return { ...base, background: "#ff3c5a14", border: "1.5px solid #ff3c5a66", color: "#ff3c5a" };
        return { ...base, opacity: 0.35 };
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
            <div style={{
                background: "#07071a", borderRadius: 16, width: 420, overflow: "hidden",
                fontFamily: "'Courier New', monospace", color: "#e0e0ff", position: "relative",
                boxShadow: "0 0 60px #00f5ff14, 0 20px 60px #00000099",
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
          @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
          .scqf-opt:hover { background: rgba(0,245,255,0.08) !important; border-color: rgba(0,245,255,0.35) !important; color: #ffffff !important; }
          .scqf-btn { background:linear-gradient(135deg,#00f5ff18,#00ff9f18); border:1.5px solid #00f5ff88; color:#00f5ff; padding:12px 32px; border-radius:10px; font-family:'Courier New',monospace; font-size:14px; font-weight:700; cursor:pointer; letter-spacing:1px; transition:all 0.2s; }
          .scqf-btn:hover { background:linear-gradient(135deg,#00f5ff30,#00ff9f30); box-shadow:0 0 20px #00f5ff44; }
        `}</style>

                {/* Grid bg */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                    <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
                        <defs>
                            <pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse">
                                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#00f5ff" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#g)" />
                    </svg>
                </div>

                <div style={{ position: "relative", zIndex: 1 }}>

                    {/* ── IDLE ── */}
                    {gameState === "idle" && (
                        <div style={{ padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
                            <div style={{ fontSize: 40 }}>🔍</div>
                            <div style={{ fontSize: 10, color: "#00f5ff88", letterSpacing: 5 }}>BLOCKCHAIN BASICS</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: "#00f5ff", textShadow: "0 0 20px #00f5ff", lineHeight: 1.3 }}>
                                Smart Contract<br />Quick Fix
                            </div>
                            <div style={{ fontSize: 13, color: "#ffffff66", lineHeight: 1.8, maxWidth: 300 }}>
                                Spot the bug in blockchain code — no coding needed! Just read the scenario and pick the right answer.
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                                {["3 Questions", "20s Each", "Multiple Choice"].map((tag) => (
                                    <span key={tag} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 20, background: "#00f5ff0e", border: "1px solid #00f5ff33", color: "#00f5ffaa" }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <button className="scqf-btn" style={{ marginTop: 8 }} onClick={startGame}>
                                Start Quiz →
                            </button>
                        </div>
                    )}

                    {/* ── GAME OVER ── */}
                    {gameState === "gameOver" && (
                        <div style={{ padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", animation: "fadeUp 0.4s ease" }}>
                            <div style={{ fontSize: 44 }}>{score === 3 ? "🏆" : score === 2 ? "👍" : "📚"}</div>
                            <div style={{ fontSize: 10, color: "#00f5ff88", letterSpacing: 4 }}>AUDIT COMPLETE</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "#00f5ff", textShadow: "0 0 20px #00f5ff" }}>
                                {score === 3 ? "Security Expert!" : score === 2 ? "Good Instincts!" : "Keep Learning!"}
                            </div>
                            <div style={{ marginTop: 4 }}>
                                <div style={{ fontSize: 10, color: "#ffffff33", letterSpacing: 3, marginBottom: 4 }}>YOUR SCORE</div>
                                <div style={{ fontSize: 56, fontWeight: 700, color: "#ffd700", textShadow: "0 0 20px #ffd700aa", lineHeight: 1 }}>
                                    {score}<span style={{ fontSize: 24, color: "#ffffff44" }}>/{QUESTIONS.length}</span>
                                </div>
                            </div>
                            <div style={{ fontSize: 13, color: "#ffffff55", maxWidth: 280, lineHeight: 1.7 }}>
                                {score === 3
                                    ? "Perfect score! You spotted every vulnerability. Real blockchains need people like you!"
                                    : score === 2
                                        ? "You're getting the hang of it. A bit more practice and you'll be a pro!"
                                        : "Blockchain security takes time to learn. Try again to improve!"}
                            </div>
                            <button className="scqf-btn" style={{ marginTop: 8 }} onClick={startGame}>
                                Play Again →
                            </button>
                        </div>
                    )}

                    {/* ── PLAYING / FEEDBACK ── */}
                    {(gameState === "playing" || gameState === "feedback") && current && (
                        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp 0.3s ease" }}>

                            {/* Progress dots + timer */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ display: "flex", gap: 5 }}>
                                    {shuffled.map((_, i) => (
                                        <div key={i} style={{
                                            width: 26, height: 5, borderRadius: 3,
                                            background: i < questionIndex ? "#00ff9f" : i === questionIndex ? "#00f5ff" : "#ffffff14",
                                            boxShadow: i === questionIndex ? "0 0 8px #00f5ff" : "none",
                                            transition: "all 0.3s",
                                        }} />
                                    ))}
                                </div>
                                <div style={{
                                    fontSize: 15, fontWeight: 700, color: timerColor,
                                    textShadow: `0 0 10px ${timerColor}`,
                                    animation: timeLeft <= 5 && gameState === "playing" ? "pulse 0.6s infinite" : "none",
                                    minWidth: 36, textAlign: "right",
                                }}>
                                    {timeLeft}s
                                </div>
                            </div>

                            {/* Timer bar */}
                            <div style={{ height: 3, background: "#ffffff0a", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, borderRadius: 2, transition: "width 1s linear, background 0.3s" }} />
                            </div>

                            {/* Scenario card */}
                            <div style={{ background: "#0d0d24", borderRadius: 12, padding: "16px", border: "1px solid #ffffff0a" }}>
                                <div style={{ fontSize: 10, color: "#ffffff33", letterSpacing: 2, marginBottom: 8 }}>
                                    {current.emoji} &nbsp; SCENARIO — Q{questionIndex + 1} of {shuffled.length}
                                </div>
                                <div style={{ fontSize: 13, color: "#c8d8ff", lineHeight: 1.75, marginBottom: 12 }}>
                                    {current.scenario}
                                </div>
                                <div style={{
                                    background: "#07071a", borderRadius: 8, padding: "10px 14px",
                                    border: "1px solid #ff3c5a2a", fontSize: 13,
                                    color: "#ff9fb0", fontFamily: "'Courier New', monospace",
                                }}>
                                    <span style={{ color: "#ff3c5a77", fontSize: 9, display: "block", marginBottom: 4, letterSpacing: 2 }}>
                                        ⚠ THE BUGGY PART
                                    </span>
                                    {current.bugLine}
                                </div>
                            </div>

                            {/* Question */}
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", lineHeight: 1.5 }}>
                                {current.question}
                            </div>

                            {/* Options */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {current.options.map((opt, idx) => (
                                    <button
                                        key={idx}
                                        className={gameState === "playing" ? "scqf-opt" : ""}
                                        onClick={() => handleSelect(idx)}
                                        disabled={gameState === "feedback"}
                                        style={optionStyle(idx)}
                                    >
                                        <span style={{ color: "#ffffff22", marginRight: 10, fontSize: 11, fontWeight: 700 }}>
                                            {["A", "B", "C", "D"][idx]}
                                        </span>
                                        {opt}
                                        {gameState === "feedback" && idx === current.correctIndex && (
                                            <span style={{ float: "right", color: "#00ff9f", fontWeight: 700 }}>✓</span>
                                        )}
                                        {gameState === "feedback" && idx === selected && idx !== current.correctIndex && (
                                            <span style={{ float: "right", color: "#ff3c5a", fontWeight: 700 }}>✗</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Explanation */}
                            {gameState === "feedback" && (
                                <div style={{
                                    borderRadius: 10, padding: "14px 16px", animation: "fadeUp 0.3s ease",
                                    background: selected === current.correctIndex ? "#00ff9f0d" : "#ff3c5a0d",
                                    border: `1px solid ${selected === current.correctIndex ? "#00ff9f30" : "#ff3c5a30"}`,
                                }}>
                                    <div style={{
                                        fontSize: 13, fontWeight: 700, marginBottom: 6,
                                        color: selected === current.correctIndex ? "#00ff9f" : selected === -1 ? "#ffd700" : "#ff3c5a",
                                    }}>
                                        {selected === -1 ? "⏱ Time's up!" : selected === current.correctIndex ? "✓ Correct!" : "✗ Not quite —"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#ffffffaa", lineHeight: 1.75 }}>
                                        {current.explanation}
                                    </div>
                                </div>
                            )}

                            {/* Next */}
                            {gameState === "feedback" && (
                                <button className="scqf-btn" style={{ width: "100%", padding: "12px" }} onClick={handleNext}>
                                    {questionIndex + 1 >= shuffled.length ? "See Results →" : "Next Question →"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
