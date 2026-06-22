"use client";
import { useState, useEffect } from "react";
import { authStorage } from "@/lib/auth";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = authStorage.getUser();
    setUser(u);
    setLoading(false);
  }, []);

  const login = (u: User, access: string, refresh: string) => {
    authStorage.setTokens(access, refresh);
    authStorage.setUser(u);
    setUser(u);
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
