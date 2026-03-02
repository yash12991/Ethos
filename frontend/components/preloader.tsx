"use client";

import React, { useState, useEffect } from "react";

export const Preloader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 600);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <div
                className={`fixed inset-0 z-[9999] bg-white transition-opacity duration-1000 ease-out pointer-events-none ${isReady ? "opacity-0" : "opacity-100"
                    }`}
            />
            <div className={`transition-opacity duration-1000 delay-300 ${isReady ? "opacity-100" : "opacity-0"}`}>
                {children}
            </div>
        </>
    );
};

export default Preloader;
