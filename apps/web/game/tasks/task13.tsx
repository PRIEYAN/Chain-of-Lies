/**
 * Task 13 — "Bridge Guardian"
 *
 * Blockchain-themed Among Us mini-game simulating cross-chain bridge transfers.
 * The player draws SVG paths through validator nodes in a bridge corridor to
 * transfer assets between two chains. Compromised nodes trigger exploits,
 * and the player must inspect nodes carefully before routing through them.
 *
 * Educational: teaches about cross-chain bridges, validator networks, and
 * real-world exploits (Ronin $625M, Wormhole $320M).
 *
 * Props:
 * - isSabotaged:     imposter mode — spoofed nodes appear valid then flip red
 * - bridgesRequired: number of successful bridges to win (default 5)
 * - onComplete:      callback(success, stats) fired on win or fail
 *
 * Mechanics:
 * - SVG polyline path drawing through validator nodes in center corridor
 * - Spacebar inspect mode reveals node audit stats (compromised = red flags)
 * - Double-click speed bridge for fast centralized route (higher exploit risk)
 * - Hacker orbs patrol the corridor, cancelling paths on contact
 * - Slippage timer per asset; liquidity pool drains on failures
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_ID = "task13";
const DEFAULT_BRIDGES_REQUIRED = 5;
const DEFAULT_LIQUIDITY = 100;
const LIQUIDITY_DRAIN_FAIL = 15;
const LIQUIDITY_DRAIN_SABOTAGED = 25;
const MAX_EXPLOITS = 3;
const MIN_SIGNATURES = 8;
const MIN_VALID_NODES = 3;
const SLIPPAGE_BASE = 25;             // seconds per asset
const SLIPPAGE_SABOTAGE_MULT = 0.6;
const FAST_BRIDGE_EXPLOIT_CHANCE = 0.4;
const FAST_BRIDGE_DURATION = 2000;     // ms
const HACKER_COUNT = 2;
const HACKER_SPEED = 0.6;
const PARTICLE_COUNT = 20;
const NODE_RADIUS = 20;
const NODE_SNAP_RADIUS = 30;
const UI_SYNC_INTERVAL = 100;
const INSPECT_KEY = " ";               // spacebar
const RESULT_DISPLAY_MS = 2400;

// ─── Chain Themes ─────────────────────────────────────────────────────────────

type Chain = "ethereum" | "polygon" | "arbitrum" | "optimism" | "avalanche";

const CHAIN_THEMES: Record<Chain, { bg: string; accent: string; icon: string; label: string }> = {
    ethereum: { bg: "#1a237e", accent: "#5c6bc0", icon: "◆", label: "ETHEREUM" },
    polygon: { bg: "#1a0533", accent: "#ab47bc", icon: "⬡", label: "POLYGON" },
    arbitrum: { bg: "#0d1b33", accent: "#2196f3", icon: "◎", label: "ARBITRUM" },
    optimism: { bg: "#1a0a0a", accent: "#ef5350", icon: "◉", label: "OPTIMISM" },
    avalanche: { bg: "#1a0f0f", accent: "#e53935", icon: "▲", label: "AVALANCHE" },
};

const CHAIN_PAIRS: [Chain, Chain][] = [
    ["ethereum", "polygon"],
    ["ethereum", "arbitrum"],
    ["polygon", "optimism"],
    ["arbitrum", "avalanche"],
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BridgeAsset {
    id: string;
    type: "ERC20" | "ERC721" | "ERC1155";
    symbol: string;
    amount: number;
    sourceChain: Chain;
    destChain: Chain;
    destAddress: string;
    timeWindow: number;
}

interface ValidatorNode {
    id: string;
    x: number;
    y: number;
    signatures: number;
    isCompromised: boolean;
    isSpoofed: boolean;
    revealed: boolean;
    speed: number;
    // inspection data
    auditStatus: string;
    uptime: number;
    connectedBridges: number;
    stake: number;
}

interface HackerOrb {
    id: string;
    x: number;
    y: number;
    baseY: number;
    phase: number;
    speed: number;
    direction: number;
}

type GamePhase = "idle" | "bridging" | "confirming" | "result" | "fastBridge" | "success" | "failed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBetween(a: number, b: number) { return a + Math.random() * (b - a); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function generateAddress(): string {
    const hex = "0123456789abcdef";
    let a = "0x";
    for (let i = 0; i < 4; i++) a += hex[Math.floor(Math.random() * 16)];
    return a + "…" + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
}

const ASSET_POOL: { type: "ERC20" | "ERC721" | "ERC1155"; symbol: string; amounts: number[] }[] = [
    { type: "ERC20", symbol: "USDC", amounts: [100, 250, 500, 1000, 2500] },
    { type: "ERC20", symbol: "WETH", amounts: [0.5, 1, 2.5, 5, 10] },
    { type: "ERC20", symbol: "DAI", amounts: [200, 500, 1000, 5000] },
    { type: "ERC721", symbol: "BAYC", amounts: [1] },
    { type: "ERC721", symbol: "PUNK", amounts: [1] },
    { type: "ERC1155", symbol: "LAND", amounts: [1, 2, 3] },
];

function generateAsset(source: Chain, dest: Chain): BridgeAsset {
    const pool = ASSET_POOL[Math.floor(Math.random() * ASSET_POOL.length)];
    const amount = pool.amounts[Math.floor(Math.random() * pool.amounts.length)];
    return {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: pool.type,
        symbol: pool.type === "ERC721" ? `${pool.symbol} #${Math.floor(Math.random() * 9999)}` : pool.symbol,
        amount,
        sourceChain: source,
        destChain: dest,
        destAddress: generateAddress(),
        timeWindow: Math.floor(randomBetween(20, 35)),
    };
}

function generateNodes(count: number, compromisedCount: number, isSabotaged: boolean): ValidatorNode[] {
    const nodes: ValidatorNode[] = [];
    const compromisedIds = new Set<number>();
    while (compromisedIds.size < compromisedCount) {
        compromisedIds.add(Math.floor(Math.random() * count));
    }
    const spoofId = isSabotaged ? Math.floor(Math.random() * count) : -1;

    for (let i = 0; i < count; i++) {
        const isComp = compromisedIds.has(i);
        const isSpoofed = isSabotaged && i === spoofId && !isComp;
        nodes.push({
            id: `node-${i}`,
            x: randomBetween(10, 90),
            y: randomBetween(10, 90),
            signatures: isComp ? Math.floor(randomBetween(1, 3)) : Math.floor(randomBetween(2, 5)),
            isCompromised: isComp,
            isSpoofed,
            revealed: false,
            speed: randomBetween(0.2, 0.5),
            auditStatus: isComp ? "UNAUDITED" : (Math.random() > 0.3 ? "AUDITED (Certik)" : "AUDITED (Trail of Bits)"),
            uptime: isComp ? randomBetween(40, 65) : randomBetween(95, 99.9),
            connectedBridges: isComp ? Math.floor(randomBetween(1, 10)) : Math.floor(randomBetween(200, 2000)),
            stake: isComp ? randomBetween(0.01, 0.5) : randomBetween(16, 64),
        });
    }
    return nodes;
}

function generateHackers(count: number): HackerOrb[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `hacker-${i}`,
        x: randomBetween(5, 95),
        y: randomBetween(20, 80),
        baseY: randomBetween(30, 70),
        phase: Math.random() * Math.PI * 2,
        speed: randomBetween(0.3, HACKER_SPEED),
        direction: Math.random() > 0.5 ? 1 : -1,
    }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BridgeGuardianPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();

    const isSabotaged = false;
    const bridgesRequired = DEFAULT_BRIDGES_REQUIRED;

    // ── State ──
    const [phase, setPhase] = useState<GamePhase>("idle");
    const [chainPair, setChainPair] = useState<[Chain, Chain]>(["ethereum", "polygon"]);
    const [asset, setAsset] = useState<BridgeAsset | null>(null);
    const [nodes, setNodes] = useState<ValidatorNode[]>([]);
    const [hackers, setHackers] = useState<HackerOrb[]>([]);
    const [path, setPath] = useState<number[]>([]);       // indices of connected nodes
    const [drawLine, setDrawLine] = useState<{ x: number; y: number }[]>([]); // SVG polyline points
    const [isDrawing, setIsDrawing] = useState(false);
    const [liquidity, setLiquidity] = useState(DEFAULT_LIQUIDITY);
    const [bridgesCompleted, setBridgesCompleted] = useState(0);
    const [exploits, setExploits] = useState(0);
    const [slippageTimer, setSlippageTimer] = useState(SLIPPAGE_BASE);
    const [inspecting, setInspecting] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [resultCard, setResultCard] = useState<{ success: boolean; route: "fast" | "secure"; validators: number; sigs: number; time: number } | null>(null);
    const [showExploit, setShowExploit] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [bonusMultiplier, setBonusMultiplier] = useState(1.0);
    const [routeHistory, setRouteHistory] = useState<("fast" | "secure")[]>([]);
    const [particles, setParticles] = useState<{ left: string; top: string; delay: string; duration: string }[]>([]);
    const [hackerPositions, setHackerPositions] = useState<{ x: number; y: number }[]>([]);
    const [spoofRevealId, setSpoofRevealId] = useState<string | null>(null);

    // ── Refs ──
    const corridorRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);
    const hackersRef = useRef<HackerOrb[]>([]);
    const lastFrameRef = useRef(0);
    const slippageRef = useRef(SLIPPAGE_BASE);
    const uiSyncRef = useRef(0);
    const roundStartRef = useRef(0);
    const phaseRef = useRef<GamePhase>("idle");
    const bridgesRef = useRef(0);
    const exploitsRef = useRef(0);
    const liquidityRef = useRef(DEFAULT_LIQUIDITY);
    const sigHistoryRef = useRef<number[]>([]);
    const routeHistoryRef = useRef<("fast" | "secure")[]>([]);
    const bonusRef = useRef(1.0);
    const startTimeRef = useRef(0);

    // ── Particles (static) ──
    useMemo(() => {
        const p = Array.from({ length: PARTICLE_COUNT }, () => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 4}s`,
            duration: `${2 + Math.random() * 3}s`,
        }));
        setParticles(p);
    }, []);

    // ── Already completed check ──
    useEffect(() => {
        if (completedTasks && completedTasks[TASK_ID]) {
            setIsComplete(true);
        }
    }, [completedTasks]);

    // ── Complete handler ──
    const handleTaskComplete = useCallback(() => {
        setIsComplete(true);
        try {
            if (!completedTasks || !completedTasks[TASK_ID]) {
                markTaskCompleted(TASK_ID);
                socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: 25 });
            }
        } catch (e) {
            console.warn("task emit failed", e);
        }
    }, [completedTasks, localPlayerId, markTaskCompleted]);

    // ── Spawn new round ──
    const spawnRound = useCallback(() => {
        const pair = CHAIN_PAIRS[Math.floor(Math.random() * CHAIN_PAIRS.length)];
        setChainPair(pair);
        const newAsset = generateAsset(pair[0], pair[1]);
        setAsset(newAsset);
        const nodeCount = Math.floor(randomBetween(5, 8));
        const compCount = Math.floor(randomBetween(2, 4));
        setNodes(generateNodes(nodeCount, Math.min(compCount, nodeCount - MIN_VALID_NODES), isSabotaged));
        const newHackers = generateHackers(HACKER_COUNT);
        setHackers(newHackers);
        hackersRef.current = newHackers;
        setPath([]);
        setDrawLine([]);
        setIsDrawing(false);
        setResultCard(null);
        setShowExploit(false);
        setSpoofRevealId(null);

        const tw = isSabotaged
            ? Math.floor(newAsset.timeWindow * SLIPPAGE_SABOTAGE_MULT)
            : newAsset.timeWindow;
        slippageRef.current = tw;
        setSlippageTimer(tw);
        roundStartRef.current = performance.now();

        phaseRef.current = "bridging";
        setPhase("bridging");
    }, [isSabotaged]);

    // ── Start game ──
    const startGame = useCallback(() => {
        bridgesRef.current = 0;
        exploitsRef.current = 0;
        liquidityRef.current = DEFAULT_LIQUIDITY;
        sigHistoryRef.current = [];
        routeHistoryRef.current = [];
        bonusRef.current = 1.0;
        startTimeRef.current = performance.now();

        setBridgesCompleted(0);
        setExploits(0);
        setLiquidity(DEFAULT_LIQUIDITY);
        setBonusMultiplier(1.0);
        setRouteHistory([]);

        spawnRound();
    }, [spawnRound]);

    // ── Trigger exploit ──
    const triggerExploit = useCallback(() => {
        exploitsRef.current += 1;
        setExploits(exploitsRef.current);
        setShowExploit(true);
        setTimeout(() => setShowExploit(false), 1500);

        const drain = isSabotaged ? LIQUIDITY_DRAIN_SABOTAGED : LIQUIDITY_DRAIN_FAIL;
        liquidityRef.current = Math.max(0, liquidityRef.current - drain);
        setLiquidity(liquidityRef.current);

        if (exploitsRef.current >= MAX_EXPLOITS || liquidityRef.current <= 0) {
            phaseRef.current = "failed";
            setPhase("failed");
            return;
        }

        // next round after delay
        setTimeout(() => {
            if (phaseRef.current !== "failed") spawnRound();
        }, 1800);
    }, [isSabotaged, spawnRound]);

    // ── Bridge success ──
    const bridgeSuccess = useCallback((route: "fast" | "secure", sigs: number, validatorCount: number) => {
        const timeTaken = Math.round((performance.now() - roundStartRef.current) / 1000);
        const bonusAdd = route === "secure" ? 0.2 : 0;
        bonusRef.current = Math.min(2.0, bonusRef.current + bonusAdd);
        setBonusMultiplier(bonusRef.current);

        bridgesRef.current += 1;
        setBridgesCompleted(bridgesRef.current);
        sigHistoryRef.current.push(sigs);
        routeHistoryRef.current.push(route);
        setRouteHistory([...routeHistoryRef.current]);

        setResultCard({ success: true, route, validators: validatorCount, sigs, time: timeTaken });
        phaseRef.current = "result";
        setPhase("result");

        setTimeout(() => {
            if (bridgesRef.current >= bridgesRequired) {
                phaseRef.current = "success";
                setPhase("success");
                handleTaskComplete();
            } else {
                spawnRound();
            }
        }, RESULT_DISPLAY_MS);
    }, [bridgesRequired, handleTaskComplete, spawnRound]);

    // ── Confirm path ──
    const confirmPath = useCallback(() => {
        const selectedNodes = path.map(i => nodes[i]);

        // check for compromised
        const compromised = selectedNodes.find(n => n.isCompromised);
        if (compromised) {
            // reveal it
            setNodes(prev => prev.map(n => n.id === compromised.id ? { ...n, revealed: true } : n));
            setTimeout(() => triggerExploit(), 600);
            return;
        }

        // check for spoofed (sabotage)
        const spoofed = selectedNodes.find(n => n.isSpoofed);
        if (spoofed) {
            setSpoofRevealId(spoofed.id);
            setTimeout(() => {
                setNodes(prev => prev.map(n => n.id === spoofed.id ? { ...n, revealed: true, isCompromised: true } : n));
                triggerExploit();
            }, 1500);
            return;
        }

        const totalSigs = selectedNodes.reduce((s, n) => s + n.signatures, 0);
        if (selectedNodes.length >= MIN_VALID_NODES && totalSigs >= MIN_SIGNATURES) {
            bridgeSuccess("secure", totalSigs, selectedNodes.length);
        } else {
            // Not enough sigs — drain liquidity partially
            liquidityRef.current = Math.max(0, liquidityRef.current - 8);
            setLiquidity(liquidityRef.current);
            setResultCard({ success: false, route: "secure", validators: selectedNodes.length, sigs: totalSigs, time: 0 });
            phaseRef.current = "result";
            setPhase("result");
            setTimeout(() => {
                if (liquidityRef.current <= 0) {
                    phaseRef.current = "failed";
                    setPhase("failed");
                } else {
                    spawnRound();
                }
            }, RESULT_DISPLAY_MS);
        }
    }, [path, nodes, triggerExploit, bridgeSuccess, spawnRound]);

    // ── Double-click fast bridge ──
    const fastBridge = useCallback(() => {
        phaseRef.current = "fastBridge";
        setPhase("fastBridge");

        setTimeout(() => {
            // 40% chance of hitting compromised node
            if (Math.random() < FAST_BRIDGE_EXPLOIT_CHANCE) {
                triggerExploit();
                return;
            }
            bridgeSuccess("fast", 3, 1);
        }, FAST_BRIDGE_DURATION);
    }, [triggerExploit, bridgeSuccess]);

    // ── Path drawing ──
    const getCorridorCoords = useCallback((e: React.PointerEvent) => {
        const el = corridorRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent, nodeIdx: number) => {
        if (phase !== "bridging") return;
        e.preventDefault();
        e.stopPropagation();
        setIsDrawing(true);
        setPath([nodeIdx]);
        const node = nodes[nodeIdx];
        setDrawLine([{ x: node.x, y: node.y }]);
    }, [phase, nodes]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;
        const coords = getCorridorCoords(e);
        if (!coords) return;

        // Check node snapping
        for (let i = 0; i < nodes.length; i++) {
            if (path.includes(i)) continue;
            const d = Math.hypot(nodes[i].x - coords.x, nodes[i].y - coords.y);
            if (d < (NODE_SNAP_RADIUS / 3)) {
                setPath(prev => [...prev, i]);
                setDrawLine(prev => [...prev, { x: nodes[i].x, y: nodes[i].y }]);
                return;
            }
        }

        // Update trailing line to cursor
        setDrawLine(prev => {
            const base = prev.slice(0, path.length);
            return [...base, coords];
        });
    }, [isDrawing, nodes, path, getCorridorCoords]);

    const handlePointerUp = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (path.length >= MIN_VALID_NODES) {
            phaseRef.current = "confirming";
            setPhase("confirming");
        } else {
            // Not enough nodes — reset
            setPath([]);
            setDrawLine([]);
        }
    }, [isDrawing, path]);

    // ── Double-click on node ──
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (phase === "bridging") fastBridge();
    }, [phase, fastBridge]);

    // ── Spacebar inspect ──
    useEffect(() => {
        if (!isOpen) return;
        const onDown = (e: KeyboardEvent) => {
            if (e.key === INSPECT_KEY && hoveredNode) {
                e.preventDefault();
                setInspecting(hoveredNode);
            }
        };
        const onUp = (e: KeyboardEvent) => {
            if (e.key === INSPECT_KEY) setInspecting(null);
        };
        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        return () => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
        };
    }, [isOpen, hoveredNode]);

    // ── Reset on open ──
    useEffect(() => {
        if (isOpen) {
            phaseRef.current = "idle";
            setPhase("idle");
        }
    }, [isOpen]);

    // ── Game loop (hacker patrol + slippage) ──
    useEffect(() => {
        if (phase !== "bridging" && phase !== "confirming" && phase !== "fastBridge") return;

        const loop = (now: number) => {
            const dt = Math.min((now - lastFrameRef.current) / 1000, 0.1);
            lastFrameRef.current = now;
            const current = phaseRef.current;
            if (current !== "bridging" && current !== "confirming" && current !== "fastBridge") return;

            // Hacker patrol
            const hk = hackersRef.current;
            for (const h of hk) {
                h.x += h.speed * h.direction * dt * 15;
                h.y = h.baseY + Math.sin(now / 1000 * 1.5 + h.phase) * 20;
                if (h.x > 95 || h.x < 5) h.direction *= -1;
                h.x = clamp(h.x, 5, 95);
            }

            // Slippage timer (only during bridging)
            if (current === "bridging") {
                slippageRef.current -= dt;
                if (slippageRef.current <= 0) {
                    // timeout — drain and next
                    liquidityRef.current = Math.max(0, liquidityRef.current - LIQUIDITY_DRAIN_FAIL);
                    setLiquidity(liquidityRef.current);
                    if (liquidityRef.current <= 0) {
                        phaseRef.current = "failed";
                        setPhase("failed");
                        return;
                    }
                    spawnRound();
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }
            }

            // Sync UI
            if (now - uiSyncRef.current > UI_SYNC_INTERVAL) {
                uiSyncRef.current = now;
                setSlippageTimer(Math.max(0, Math.ceil(slippageRef.current)));
                setHackerPositions(hk.map(h => ({ x: h.x, y: h.y })));
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [phase, spawnRound]);

    if (!isOpen) return null;

    const src = CHAIN_THEMES[chainPair[0]];
    const dst = CHAIN_THEMES[chainPair[1]];
    const pathSigs = path.reduce((s, i) => s + (nodes[i]?.signatures || 0), 0);
    const slipPct = asset ? (slippageTimer / (asset.timeWindow)) * 100 : 100;
    const slipColor = slipPct > 60 ? "#00e676" : slipPct > 30 ? "#ffab40" : "#ff1744";
    const liqPct = liquidity;

    const inspNode = inspecting ? nodes.find(n => n.id === inspecting) : null;

    // polyline points string
    const polyPoints = drawLine.map(p => `${p.x},${p.y}`).join(" ");

    return (
        <div style={styles.overlay}>
            <style>{CSS_KEYFRAMES}</style>
            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>✕</button>

                {/* ═══ IDLE SCREEN ═══ */}
                {phase === "idle" && !isComplete && (
                    <div style={styles.idleOverlay}>
                        <div style={styles.idleTitle}>BRIDGE GUARDIAN</div>
                        <div style={styles.idleDesc}>
                            Cross-chain bridges lock assets on one chain and mint equivalents on another.
                            They're secured by validator networks that must sign off on each transfer.
                            The Ronin Bridge hack ($625M) and Wormhole exploit ($320M) happened because
                            attackers compromised enough validator keys to forge approvals.
                            More validators and audited contracts = harder to exploit.
                        </div>
                        <div style={styles.idleInstr}>
                            Draw paths through <span style={{ color: "#00e676" }}>validator nodes</span> in
                            the bridge corridor. Collect ≥3 nodes with ≥8 total signatures.
                            Hold <span style={{ color: "#40c4ff" }}>Spacebar</span> on a node to
                            inspect it. Watch out for <span style={{ color: "#ff1744" }}>compromised nodes</span> and
                            hacker patrols!
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
                            <span style={{ color: src.accent, fontSize: 20 }}>{src.icon}</span>
                            <span style={styles.idleChainLabel}>{src.label}</span>
                            <span style={{ color: "#40c4ff" }}>⟷</span>
                            <span style={{ color: dst.accent, fontSize: 20 }}>{dst.icon}</span>
                            <span style={styles.idleChainLabel}>{dst.label}</span>
                        </div>
                        <button style={styles.startBtn} onClick={startGame}>ACTIVATE BRIDGE</button>
                    </div>
                )}

                {phase === "idle" && isComplete && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#00e676" }}>✓ TASK COMPLETED</div>
                        <div style={styles.idleDesc}>Bridge Guardian task already completed.</div>
                    </div>
                )}

                {phase === "success" && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#00e676" }}>✓ BRIDGE SECURED</div>
                        <div style={styles.idleDesc}>
                            All {bridgesRequired} assets bridged successfully. Bonus: ×{bonusMultiplier.toFixed(1)}
                        </div>
                    </div>
                )}

                {phase === "failed" && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#ff1744" }}>✕ BRIDGE COMPROMISED</div>
                        <div style={styles.idleDesc}>
                            {liquidity <= 0 ? "Liquidity pool drained." : `${exploits} exploit(s) detected.`} The bridge has been shut down.
                        </div>
                        <button style={styles.startBtn} onClick={startGame}>RETRY</button>
                    </div>
                )}

                {/* ═══ HUD TOP ═══ */}
                {(phase === "bridging" || phase === "confirming" || phase === "result" || phase === "fastBridge") && (
                    <div style={styles.hudTop}>
                        <span style={styles.hudTitle}>BRIDGE GUARDIAN</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={styles.hudLabel}>💧 Liquidity:</span>
                            <div style={styles.liqBar}>
                                <div className="ca-liq-fill" style={{ ...styles.liqFill, width: `${liqPct}%`, background: liqPct > 50 ? "#00e676" : liqPct > 25 ? "#ffab40" : "#ff1744" }} />
                            </div>
                            <span style={{ ...styles.hudValue, fontSize: 11 }}>{liqPct}%</span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Bridges: </span>
                            <span style={{ ...styles.hudValue, color: "#00e676" }}>{bridgesCompleted}/{bridgesRequired}</span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Exploits: </span>
                            <span style={{ ...styles.hudValue, color: exploits > 0 ? "#ff1744" : "#e0ecf8" }}>{exploits}/{MAX_EXPLOITS}</span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Bonus: </span>
                            <span style={{ ...styles.hudValue, color: "#ffd740" }}>×{bonusMultiplier.toFixed(1)}</span>
                        </div>
                    </div>
                )}

                {/* ═══ MAIN GAME AREA ═══ */}
                {(phase === "bridging" || phase === "confirming" || phase === "result" || phase === "fastBridge") && (
                    <div style={styles.gameArea}>
                        {/* SOURCE CHAIN */}
                        <div style={{ ...styles.chainPanel, background: src.bg, borderRight: `2px solid ${src.accent}40` }}>
                            <div style={{ ...styles.chainName, color: src.accent }}>
                                <span style={{ fontSize: 22 }}>{src.icon}</span> {src.label}
                            </div>
                            {asset && (
                                <div style={styles.assetCard}>
                                    <div style={styles.assetType}>{asset.type}</div>
                                    <div style={styles.assetSymbol}>{asset.symbol}</div>
                                    <div style={styles.assetAmount}>
                                        {asset.type === "ERC721" ? "" : `${asset.amount} `}{asset.type !== "ERC721" ? asset.symbol : ""}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* BRIDGE CORRIDOR */}
                        <div
                            ref={corridorRef}
                            style={styles.corridor}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        >
                            {/* Flowing particles */}
                            {particles.map((p, i) => (
                                <div key={i} className="bg-particle" style={{
                                    position: "absolute", width: 3, height: 3,
                                    borderRadius: "50%", background: "rgba(64,196,255,0.3)",
                                    left: p.left, top: p.top,
                                    animationDelay: p.delay, animationDuration: p.duration,
                                }} />
                            ))}

                            {/* Slippage bar */}
                            <div style={styles.slipBar}>
                                <div style={{ ...styles.slipFill, width: `${slipPct}%`, background: slipColor }} />
                                <span style={styles.slipLabel}>{slippageTimer}s</span>
                            </div>

                            {/* SVG overlay for path drawing */}
                            <svg style={styles.svgOverlay} viewBox="0 0 100 100" preserveAspectRatio="none">
                                {drawLine.length > 1 && (
                                    <polyline
                                        points={polyPoints}
                                        fill="none"
                                        stroke="#40c4ff"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray="4 2"
                                        className="bg-pathflow"
                                        style={{ filter: "drop-shadow(0 0 3px #40c4ff)" }}
                                    />
                                )}
                            </svg>

                            {/* Validator nodes */}
                            {nodes.map((n, i) => {
                                const isInPath = path.includes(i);
                                const isRevealed = n.revealed || (n.id === spoofRevealId);
                                const showRed = isRevealed && (n.isCompromised || n.isSpoofed);
                                return (
                                    <div
                                        key={n.id}
                                        style={{
                                            position: "absolute",
                                            left: `${n.x}%`, top: `${n.y}%`,
                                            transform: "translate(-50%, -50%)",
                                            width: NODE_RADIUS * 2, height: NODE_RADIUS * 2,
                                            borderRadius: "50%",
                                            background: showRed ? "#ff1744" : (isInPath ? "#00e676" : "rgba(0,230,118,0.7)"),
                                            boxShadow: showRed
                                                ? "0 0 12px #ff1744, 0 0 24px rgba(255,23,68,0.4)"
                                                : isInPath
                                                    ? "0 0 12px #00e676, 0 0 24px rgba(0,230,118,0.3)"
                                                    : "0 0 8px rgba(0,230,118,0.3)",
                                            cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 10, fontWeight: 700, color: "#000",
                                            transition: "background 0.2s, box-shadow 0.2s",
                                            zIndex: 10,
                                            border: isInPath ? "2px solid #fff" : "2px solid transparent",
                                        }}
                                        onPointerDown={(e) => handlePointerDown(e, i)}
                                        onDoubleClick={handleDoubleClick}
                                        onPointerEnter={() => setHoveredNode(n.id)}
                                        onPointerLeave={() => setHoveredNode(null)}
                                    >
                                        {showRed ? "💀" : n.signatures}
                                        {isInPath && !showRed && (
                                            <span style={{ position: "absolute", top: -8, right: -8, fontSize: 12, color: "#00e676" }}>✓</span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Hacker orbs */}
                            {hackerPositions.map((h, i) => (
                                <div key={i} className="bg-hacker" style={{
                                    position: "absolute",
                                    left: `${h.x}%`, top: `${h.y}%`,
                                    transform: "translate(-50%, -50%)",
                                    width: 28, height: 28, borderRadius: "50%",
                                    background: "rgba(255,23,68,0.3)",
                                    boxShadow: "0 0 10px #ff1744, 0 0 20px rgba(255,23,68,0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14, zIndex: 8, pointerEvents: "none",
                                }}>💀</div>
                            ))}

                            {/* Fast bridge tooltip */}
                            {phase === "fastBridge" && (
                                <div style={styles.fastBridgeBanner}>
                                    ⚡ FAST BRIDGE — Centralized Route...
                                </div>
                            )}
                        </div>

                        {/* DESTINATION CHAIN */}
                        <div style={{ ...styles.chainPanel, background: dst.bg, borderLeft: `2px solid ${dst.accent}40` }}>
                            <div style={{ ...styles.chainName, color: dst.accent }}>
                                <span style={{ fontSize: 22 }}>{dst.icon}</span> {dst.label}
                            </div>
                            {asset && (
                                <div style={styles.destCard}>
                                    <div style={{ fontSize: 10, color: "#5a7a99", letterSpacing: 1 }}>DESTINATION</div>
                                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e0ecf8", marginTop: 6 }}>{asset.destAddress}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ HUD BOTTOM ═══ */}
                {(phase === "bridging" || phase === "confirming") && (
                    <div style={styles.hudBottom}>
                        <span style={styles.hudLabel}>Signatures: </span>
                        <span style={{ ...styles.hudValue, fontSize: 12, color: pathSigs >= MIN_SIGNATURES ? "#00e676" : "#ffab40" }}>
                            {pathSigs}/{MIN_SIGNATURES}
                        </span>
                        <span style={styles.hudLabel}>Nodes: </span>
                        <span style={{ ...styles.hudValue, fontSize: 12, color: path.length >= MIN_VALID_NODES ? "#00e676" : "#ffab40" }}>
                            {path.length}/{MIN_VALID_NODES}
                        </span>
                        {phase === "confirming" && (
                            <button style={styles.confirmBtn} onClick={confirmPath}>
                                CONFIRM TRANSFER
                            </button>
                        )}
                        {phase === "bridging" && path.length === 0 && (
                            <span style={{ fontSize: 10, color: "#5a7a99", marginLeft: "auto" }}>
                                Click a node to start drawing · Double-click for fast bridge · Hold Space to inspect
                            </span>
                        )}
                        {phase === "confirming" && (
                            <button style={{ ...styles.confirmBtn, background: "rgba(255,255,255,0.05)", borderColor: "#555", color: "#aaa" }}
                                onClick={() => { setPath([]); setDrawLine([]); phaseRef.current = "bridging"; setPhase("bridging"); }}>
                                RESET PATH
                            </button>
                        )}
                    </div>
                )}

                {/* ═══ RESULT CARD ═══ */}
                {phase === "result" && resultCard && (
                    <div style={styles.resultOverlay}>
                        <div style={styles.resultBox}>
                            <div style={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 16, fontWeight: 700, letterSpacing: 2,
                                color: resultCard.success ? "#00e676" : "#ff1744",
                                marginBottom: 12,
                            }}>
                                {resultCard.success ? "✅ BRIDGE SECURED" : "❌ INSUFFICIENT SECURITY"}
                            </div>
                            <div style={styles.resultRow}>
                                <span style={styles.resultLabel}>Route:</span>
                                <span style={{ color: resultCard.route === "secure" ? "#00e676" : "#ffab40" }}>
                                    {resultCard.route === "secure" ? "DECENTRALIZED" : "CENTRALIZED"}
                                </span>
                            </div>
                            <div style={styles.resultRow}>
                                <span style={styles.resultLabel}>Validators:</span>
                                <span>{resultCard.validators}</span>
                            </div>
                            <div style={styles.resultRow}>
                                <span style={styles.resultLabel}>Signatures:</span>
                                <span>{resultCard.sigs}</span>
                            </div>
                            {resultCard.success && resultCard.route === "secure" && (
                                <div style={styles.resultRow}>
                                    <span style={styles.resultLabel}>Bonus:</span>
                                    <span style={{ color: "#ffd740" }}>+×0.2</span>
                                </div>
                            )}
                            {resultCard.success && (
                                <div style={{ fontSize: 10, color: "#5a7a99", marginTop: 8, fontStyle: "italic" }}>
                                    "More validators = harder to hack"
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ INSPECTION PANEL ═══ */}
                {inspNode && (
                    <div style={styles.inspectPanel}>
                        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#00e5ff", marginBottom: 8 }}>
                            ◉ VALIDATOR NODE #{inspNode.id.split("-")[1]}
                        </div>
                        <div style={styles.inspRow}>
                            <span>Signatures:</span>
                            <span style={{ color: inspNode.signatures >= 3 ? "#00e676" : "#ffab40" }}>{inspNode.signatures}</span>
                        </div>
                        <div style={styles.inspRow}>
                            <span>Audit status:</span>
                            <span style={{ color: inspNode.auditStatus.includes("UNAUDITED") ? "#ff1744" : "#00e676" }}>
                                {inspNode.auditStatus.includes("UNAUDITED") ? "⚠️" : "✅"} {inspNode.auditStatus}
                            </span>
                        </div>
                        <div style={styles.inspRow}>
                            <span>Uptime:</span>
                            <span style={{ color: inspNode.uptime < 80 ? "#ff1744" : "#e0ecf8" }}>{inspNode.uptime.toFixed(1)}%</span>
                        </div>
                        <div style={styles.inspRow}>
                            <span>Connected bridges:</span>
                            <span style={{ color: inspNode.connectedBridges < 20 ? "#ff1744" : "#e0ecf8" }}>{inspNode.connectedBridges}</span>
                        </div>
                        <div style={styles.inspRow}>
                            <span>Stake:</span>
                            <span style={{ color: inspNode.stake < 1 ? "#ff1744" : "#e0ecf8" }}>{inspNode.stake.toFixed(2)} ETH</span>
                        </div>
                    </div>
                )}

                {/* Exploit flash */}
                {showExploit && (
                    <>
                        <div className="bg-exploit-vignette" style={styles.exploitVignette} />
                        <div className="bg-exploit-text" style={styles.exploitText}>EXPLOIT DETECTED</div>
                    </>
                )}

                {/* Completed badge */}
                {completedTasks && completedTasks[TASK_ID] && (
                    <div style={styles.completedBadge}>✓ COMPLETED</div>
                )}
            </div>
        </div>
    );
}

// ─── CSS Keyframes ────────────────────────────────────────────────────────────

const CSS_KEYFRAMES = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

.bg-particle {
    animation: bgParticleFlow 3s linear infinite;
}
@keyframes bgParticleFlow {
    0% { transform: translateX(-20px); opacity: 0; }
    20% { opacity: 0.6; }
    80% { opacity: 0.6; }
    100% { transform: translateX(40px); opacity: 0; }
}

.bg-pathflow {
    animation: bgDashFlow 1s linear infinite;
}
@keyframes bgDashFlow {
    to { stroke-dashoffset: -12; }
}

.bg-hacker {
    animation: bgHackerPulse 0.8s ease-in-out infinite alternate;
}
@keyframes bgHackerPulse {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
    100% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
}

.bg-exploit-vignette {
    animation: bgExploitFlash 1.5s ease-out forwards;
}
@keyframes bgExploitFlash {
    0% { opacity: 0; }
    20% { opacity: 1; }
    100% { opacity: 0; }
}

.bg-exploit-text {
    animation: bgExploitTextFlash 1.5s ease-out forwards;
}
@keyframes bgExploitTextFlash {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    30% { transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

.ca-liq-fill {
    transition: width 0.5s ease;
}
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    },
    modal: {
        background: "#07090f",
        borderRadius: 12,
        border: "2px solid rgba(64,196,255,0.15)",
        width: "96%",
        maxWidth: 900,
        height: "88vh",
        maxHeight: 650,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(64,196,255,0.06)",
    },
    closeBtn: {
        position: "absolute",
        top: 8, right: 8,
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(64,196,255,0.3)",
        color: "#40c4ff",
        borderRadius: "50%",
        width: 30, height: 30,
        cursor: "pointer",
        zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16,
    },

    // Idle
    idleOverlay: {
        position: "absolute", inset: 0, zIndex: 30,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(7,9,15,0.95)", backdropFilter: "blur(8px)", padding: 24,
    },
    idleTitle: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 22, fontWeight: 900, letterSpacing: 4,
        textTransform: "uppercase", marginBottom: 14, color: "#40c4ff", textAlign: "center",
    },
    idleDesc: {
        fontSize: 11, maxWidth: 500, textAlign: "center", lineHeight: 1.7, color: "#7a9ab8", marginBottom: 14,
    },
    idleInstr: {
        fontSize: 11, maxWidth: 500, textAlign: "center", lineHeight: 1.7, color: "#c0d8f0", marginBottom: 20,
    },
    idleChainLabel: {
        fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#e0ecf8", letterSpacing: 2,
    },
    startBtn: {
        fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2,
        textTransform: "uppercase", padding: "11px 32px",
        border: "2px solid #40c4ff", borderRadius: 8,
        background: "rgba(64,196,255,0.08)", color: "#40c4ff", cursor: "pointer",
    },

    // HUD
    hudTop: {
        position: "absolute", left: 0, right: 0, top: 0, zIndex: 20,
        padding: "7px 12px",
        background: "rgba(7,9,15,0.9)", backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(64,196,255,0.12)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    },
    hudBottom: {
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20,
        padding: "7px 12px",
        background: "rgba(7,9,15,0.9)", backdropFilter: "blur(6px)",
        borderTop: "1px solid rgba(64,196,255,0.12)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    },
    hudTitle: {
        fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 11,
        color: "#40c4ff", letterSpacing: 2, textTransform: "uppercase",
    },
    hudLabel: { fontSize: 10, color: "#5a7a99", textTransform: "uppercase", letterSpacing: 1 },
    hudValue: { fontFamily: "'Orbitron', sans-serif", fontSize: 12, color: "#e0ecf8", fontWeight: 700 },

    liqBar: { width: 70, height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" },
    liqFill: { height: "100%", borderRadius: 4 },

    // Game area
    gameArea: {
        position: "absolute", top: 40, bottom: 38, left: 0, right: 0,
        display: "flex",
    },
    chainPanel: {
        width: "22%", minWidth: 120, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 12, gap: 16,
    },
    chainName: {
        fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700,
        letterSpacing: 2, textTransform: "uppercase",
        display: "flex", alignItems: "center", gap: 8,
    },
    assetCard: {
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "12px 14px", textAlign: "center", width: "90%",
    },
    assetType: { fontSize: 9, color: "#5a7a99", letterSpacing: 2, marginBottom: 4 },
    assetSymbol: {
        fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700,
        color: "#e0ecf8", marginBottom: 4,
    },
    assetAmount: { fontSize: 11, color: "#7a9ab8" },
    destCard: {
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "12px 14px", textAlign: "center", width: "90%",
    },

    // Corridor
    corridor: {
        flex: 1, position: "relative", background: "#0d1117",
        borderLeft: "1px solid rgba(64,196,255,0.08)",
        borderRight: "1px solid rgba(64,196,255,0.08)",
        overflow: "hidden", cursor: "crosshair",
    },
    svgOverlay: {
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 5,
    },
    slipBar: {
        position: "absolute", top: 4, left: 8, right: 8, height: 6,
        background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", zIndex: 12,
    },
    slipFill: { height: "100%", borderRadius: 3, transition: "width 0.3s linear" },
    slipLabel: {
        position: "absolute", right: 4, top: -1, fontSize: 8, color: "#7a9ab8",
        fontFamily: "'Share Tech Mono', monospace",
    },
    fastBridgeBanner: {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700,
        color: "#ffab40", letterSpacing: 2, textShadow: "0 0 20px rgba(255,171,64,0.5)",
        zIndex: 15,
    },

    // Confirm button
    confirmBtn: {
        fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 10,
        letterSpacing: 1, textTransform: "uppercase",
        padding: "6px 16px", border: "1px solid #00e676", borderRadius: 6,
        background: "rgba(0,230,118,0.08)", color: "#00e676", cursor: "pointer",
        marginLeft: "auto",
    },

    // Result
    resultOverlay: {
        position: "absolute", inset: 0, zIndex: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(7,9,15,0.85)", backdropFilter: "blur(4px)",
    },
    resultBox: {
        background: "#0d1117", border: "1px solid rgba(64,196,255,0.15)",
        borderRadius: 10, padding: "20px 28px", minWidth: 260,
    },
    resultRow: {
        display: "flex", justifyContent: "space-between", fontSize: 12,
        color: "#e0ecf8", marginBottom: 6,
    },
    resultLabel: { color: "#5a7a99" },

    // Inspect
    inspectPanel: {
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        zIndex: 35, background: "rgba(13,17,23,0.95)", border: "1px solid rgba(0,229,255,0.2)",
        borderRadius: 8, padding: "14px 18px", minWidth: 220,
        boxShadow: "0 0 30px rgba(0,229,255,0.1)",
    },
    inspRow: {
        display: "flex", justifyContent: "space-between", fontSize: 11,
        color: "#e0ecf8", marginBottom: 5, gap: 12,
    },

    // Effects
    exploitVignette: {
        position: "absolute", inset: 0, zIndex: 36, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(255,23,68,0.4) 100%)",
    },
    exploitText: {
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)", zIndex: 37, pointerEvents: "none",
        fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 900,
        color: "#ff1744", letterSpacing: 4,
        textShadow: "0 0 30px rgba(255,23,68,0.8)",
    },

    completedBadge: {
        position: "absolute", top: 8, left: 8, zIndex: 40,
        fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700,
        letterSpacing: 2, color: "#00e676",
        background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.3)",
        borderRadius: 4, padding: "3px 8px",
    },
};
