"use client";

import Cookies from "js-cookie";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:5000/api/v1";

function getSocketUrl() {
  return API_BASE_URL.replace(/\/api\/v1$/, "");
}

export function getChatSocket() {
  const token = Cookies.get("accessToken");
  if (!token) return null;

  if (socket && socket.connected) {
    const existingToken = (socket.auth as { token?: string } | undefined)?.token;
    if (existingToken === token) return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    transports: ["websocket"],
    auth: { token },
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
