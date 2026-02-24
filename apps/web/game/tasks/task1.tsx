import { useState, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type Block = {
    value: number;
    correct: number;
    isTampered: boolean;
};

type GameState = "playing" | "success";

function generateSequence(length: number = 6): Block[] {
    const startExp = Math.floor(Math.random() * 4) + 1;
    const correct = Array.from({ length }, (_, i) =>
        Math.pow(2, startExp + i)
    );

    const tamperedIndex = Math.floor(Math.random() * length);
    const tamperOffset =
        [3, 5, 6, 7, 9, 10, 11, 13][Math.floor(Math.random() * 8)];

    return correct.map((val, i) => ({
        value: i === tamperedIndex ? val + tamperOffset : val,
        correct: val,
        isTampered: i === tamperedIndex,
    }));
}

export default function BrokenSequencePopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task1";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    const [blocks, setBlocks] = useState<Block[]>(() =>
        generateSequence()
    );
    const [gameState, setGameState] =
        useState<GameState>("playing");
    const [message, setMessage] = useState<string>("");

    const handleClick = useCallback(
        (index: number) => {
            if (gameState === "success") return;

            if (completedTasks && completedTasks[TASK_ID]) {
                setMessage("You have already completed this task.");
                setTimeout(() => setMessage(""), 1500);
                return;
            }

            const block = blocks[index];

            if (block.isTampered) {
                const fixed = blocks.map((b) =>
                    b.isTampered ? { ...b, value: b.correct } : b
                );

                setBlocks(fixed);
                setGameState("success");
                setMessage("Ledger Recalibrated");
                // Mark locally and notify server
                try {
                    markTaskCompleted(TASK_ID);
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: 8 });
                } catch (e) {
                    console.warn("task emit failed", e);
                }
            } else {
                setMessage("That block is valid.");
                setTimeout(() => setMessage(""), 1500);
            }
        },
        [blocks, gameState, completedTasks, localPlayerId, markTaskCompleted]
    );

    const resetGame = () => {
        setBlocks(generateSequence());
        setGameState("playing");
        setMessage("");
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>
                    ✕
                </button>

                <h2 style={styles.title}>
                    Broken Sequence Challenge
                </h2>
                <p style={styles.subtitle}>
                    Detect the tampered block.
                </p>

                <div style={styles.sequenceRow}>
                    {blocks.map((block, i) => (
                        <div
                            key={i}
                            style={{
                                ...styles.block,
                                ...(gameState === "success"
                                    ? styles.blockSuccess
                                    : {}),
                            }}
                            onClick={() => handleClick(i)}
                        >
                            {block.value}
                        </div>
                    ))}
                </div>

                {message && (
                    <div
                        style={{
                            ...styles.message,
                            ...(gameState === "success"
                                ? styles.msgSuccess
                                : styles.msgWarn),
                        }}
                    >
                        {message}
                    </div>
                )}

                {/* Completed badge for local player */}
                {completedTasks && completedTasks[TASK_ID] && (
                  <div style={{ marginBottom: 12, color: '#9aa' }}>Completed</div>
                )}

                <button style={styles.resetBtn} onClick={resetGame}>
                    Try Again
                </button>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modal: {
        background: "#0c0c1f",
        padding: "40px",
        borderRadius: "16px",
        width: "90%",
        maxWidth: "600px",
        textAlign: "center",
        boxShadow: "0 0 40px rgba(100,100,255,0.2)",
        maxHeight: "95vh",
        overflow: "hidden",
    },
    closeBtn: {
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "transparent",
        border: "none",
        color: "#aaa",
        fontSize: "18px",
        cursor: "pointer",
    },
    title: {
        color: "#e8e8ff",
        marginBottom: "8px",
    },
    subtitle: {
        color: "#7777aa",
        fontSize: "13px",
        marginBottom: "24px",
    },
    sequenceRow: {
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "20px",
    },
    block: {
        width: "80px",
        height: "80px",
        borderRadius: "10px",
        background: "#1a1a3a",
        border: "1px solid #333366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: 700,
        color: "#c8c8ff",
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    blockSuccess: {
        background: "#003d22",
        border: "1px solid #00ff9d",
        color: "#00ff9d",
    },
    message: {
        marginBottom: "16px",
        padding: "10px",
        borderRadius: "8px",
        fontSize: "14px",
    },
    msgSuccess: {
        background: "rgba(0, 60, 30, 0.6)",
        border: "1px solid #00ff9d",
        color: "#00ff9d",
    },
    msgWarn: {
        background: "rgba(60, 40, 0, 0.6)",
        border: "1px solid #ffaa00",
        color: "#ffaa00",
    },
    resetBtn: {
        padding: "8px 16px",
        borderRadius: "6px",
        border: "1px solid #4444aa",
        background: "transparent",
        color: "#8888ff",
        cursor: "pointer",
    },
};
