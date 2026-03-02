import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const accessToken = request.cookies.get("accessToken")?.value;
    const authUserCookie = request.cookies.get("authUser")?.value;
    const { pathname } = request.nextUrl;

    const isHrLoginRoute = pathname === "/hr/login";
    // Protected routes
    const isProtectedRoute =
        pathname.startsWith("/dashboard") || (pathname.startsWith("/hr") && !isHrLoginRoute);

    // Auth routes (login/signup)
    const isAuthRoute =
        pathname.startsWith("/auth/login") ||
        pathname.startsWith("/auth/signup") ||
        isHrLoginRoute;

    if (isProtectedRoute && !accessToken) {
        // Redirect unauthenticated users to login
        const loginUrl = new URL("/auth/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    if (isAuthRoute && accessToken && !isHrLoginRoute) {
        // Redirect authenticated users away from auth pages.
        let isHrUser = false;
        try {
            const parsed = authUserCookie ? JSON.parse(authUserCookie) : null;
            isHrUser = parsed?.userType === "hr";
        } catch {
            isHrUser = false;
        }

        const dashboardUrl = new URL(isHrUser ? "/hr/dashboard" : "/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        "/dashboard/:path*",
        "/hr/:path*",
        "/auth/login",
        "/auth/signup",
        "/hr/login",
    ],
};
