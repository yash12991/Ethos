"use client";

import React from "react";

export const ModernBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            {/* Matte Noise Texture Overlay */}
            <div className="noise-texture" />

            {/* Structural Dot Grid - Refined */}
            <div className="absolute inset-0 bg-grid-white opacity-100 dark:opacity-50" />

            {/* Institutional Neural Nodes (SVG) */}
            <div className="absolute inset-0 z-0">
                <svg className="w-full h-full opacity-[0.3] dark:opacity-[0.35]">
                    <defs>
                        <radialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <g className="text-primary">
                        <circle cx="20%" cy="30%" r="3" className="animate-pulse-slow" />
                        <circle cx="80%" cy="20%" r="2" className="animate-pulse-slow [animation-delay:2s]" />
                        <circle cx="50%" cy="60%" r="4" className="animate-pulse-slow [animation-delay:4s]" />
                        <circle cx="15%" cy="85%" r="2" className="animate-pulse-slow [animation-delay:1s]" />
                        <circle cx="90%" cy="75%" r="3" className="animate-pulse-slow [animation-delay:3s]" />
                    </g>
                </svg>
            </div>

            {/* Animated Mesh Blobs - Optimized Drift */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                {/* Security Blue Hub */}
                <div
                    className="absolute -top-[30%] -left-[15%] w-[90%] h-[90%] rounded-full bg-primary/15 blur-[140px] animate-blob mix-blend-multiply dark:mix-blend-soft-light"
                    style={{ animationDuration: '25s' }}
                />

                {/* Trust Purple Hub */}
                <div
                    className="absolute top-[10%] -right-[20%] w-[85%] h-[85%] rounded-full bg-accent/15 blur-[140px] animate-blob mix-blend-multiply dark:mix-blend-soft-light"
                    style={{ animationDuration: '30s', animationDelay: '-5s' }}
                />

                {/* Safety Indigo Pulse */}
                <div
                    className="absolute bottom-[-10%] left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 blur-[120px] animate-blob mix-blend-multiply dark:mix-blend-soft-light"
                    style={{ animationDuration: '35s', animationDelay: '-10s' }}
                />
            </div>

            {/* Final Cinematic Vibe Filter & Base Color */}
            <div className="absolute inset-0 bg-background opacity-100 -z-20" />
            <div
                className="absolute inset-0 opacity-40 dark:opacity-60 -z-15"
                style={{
                    backgroundImage: `
                        radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.1) 0, transparent 40%),
                        radial-gradient(at 100% 0%, rgba(124, 58, 237, 0.1) 0, transparent 40%)
                    `
                }}
            />
            <div className="absolute inset-0 bg-linear-to-b from-background via-transparent to-background opacity-80" />
        </div>
    );
};

export default ModernBackground;
