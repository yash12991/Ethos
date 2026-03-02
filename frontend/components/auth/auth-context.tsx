"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Cookies from "js-cookie";
import { AuthUser } from "@/lib/auth-api";

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (user: AuthUser, tokens: { accessToken: string; refreshToken: string }) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = Cookies.get("authUser");
        const accessToken = Cookies.get("accessToken");

        if (!savedUser || !accessToken) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            setUser(JSON.parse(savedUser) as AuthUser);
        } catch {
            console.error("Failed to parse authUser cookie");
            Cookies.remove("accessToken");
            Cookies.remove("refreshToken");
            Cookies.remove("authUser");
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (userData: AuthUser, tokens: { accessToken: string; refreshToken: string }) => {
        setUser(userData);

        // Persist session in cookies
        Cookies.set("accessToken", tokens.accessToken, { expires: 7 }); // expires in 7 days (or use JWT expiry)
        Cookies.set("refreshToken", tokens.refreshToken, { expires: 30 });
        Cookies.set("authUser", JSON.stringify(userData), { expires: 7 });
    };

    const logout = () => {
        const isHrUser = user?.userType === "hr";
        setUser(null);
        Cookies.remove("accessToken");
        Cookies.remove("refreshToken");
        Cookies.remove("authUser");
        window.location.href = isHrUser ? "/hr/login" : "/auth/login";
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
