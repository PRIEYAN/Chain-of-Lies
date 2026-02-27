import React, { useEffect, useRef, useState } from "react";

export default function OnScreenControls() {
    const joystickRef = useRef<HTMLDivElement>(null);
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Track currently active simulated keys
    const activeKeys = useRef<Set<string>>(new Set());

    const simulateKey = (key: string, isDown: boolean) => {
        if (isDown && !activeKeys.current.has(key)) {
            activeKeys.current.add(key);
            document.dispatchEvent(new KeyboardEvent("keydown", { key }));
        } else if (!isDown && activeKeys.current.has(key)) {
            activeKeys.current.delete(key);
            document.dispatchEvent(new KeyboardEvent("keyup", { key }));
        }
    };

    const updateJoystick = (clientX: number, clientY: number) => {
        if (!joystickRef.current) return;
        const rect = joystickRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Max distance the knob can travel
        const maxDist = rect.width / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        setJoystickPos({ x: dx, y: dy });

        // Determine direction and simulate keys
        const threshold = maxDist * 0.3; // 30% pushed to trigger movement

        simulateKey("w", dy < -threshold);
        simulateKey("s", dy > threshold);
        simulateKey("a", dx < -threshold);
        simulateKey("d", dx > threshold);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        updateJoystick(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        // Prevent scrolling wildly
        e.preventDefault();
        updateJoystick(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setJoystickPos({ x: 0, y: 0 });
        // Release all keys
        simulateKey("w", false);
        simulateKey("a", false);
        simulateKey("s", false);
        simulateKey("d", false);
    };

    // Also support mouse for testing in dev tools
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateJoystick(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        updateJoystick(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            setJoystickPos({ x: 0, y: 0 });
            simulateKey("w", false);
            simulateKey("a", false);
            simulateKey("s", false);
            simulateKey("d", false);
        }
    };

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    const handleInteractDown = () => {
        simulateKey("e", true);
    };

    const handleInteractUp = () => {
        simulateKey("e", false);
    };

    return (
        <div className="md:hidden fixed inset-0 pointer-events-none z-50 flex items-end justify-start p-6 pb-12 gap-8">
            {/* Joystick Area */}
            <div
                ref={joystickRef}
                className="relative w-32 h-32 bg-white/10 border-2 border-white/20 rounded-full pointer-events-auto touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onMouseDown={handleMouseDown}
            >
                {/* Joystick Knob */}
                <div
                    className="absolute w-12 h-12 bg-white/50 rounded-full shadow-lg left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))` }}
                />
            </div>

            {/* Interact Button (placed left next to joystick) */}
            <div className="flex flex-col items-center justify-end h-32 mb-4 pointer-events-auto">
                <button
                    className="w-16 h-16 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center text-white active:bg-white/40 transition-colors touch-none"
                    onTouchStart={handleInteractDown}
                    onTouchEnd={handleInteractUp}
                    onTouchCancel={handleInteractUp}
                    onMouseDown={handleInteractDown}
                    onMouseUp={handleInteractUp}
                    onMouseLeave={handleInteractUp}
                >
                    <span className="font-bold text-xl drop-shadow-md">E</span>
                </button>
            </div>
        </div>
    );
}
