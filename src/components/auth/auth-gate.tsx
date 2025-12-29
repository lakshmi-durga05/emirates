"use client";

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, getRoles, hasRole } from '@/lib/auth';

const publicPaths = new Set<string>(["/login", "/signup"]);
const adminOnly = new Set<string>([
  "/",
  "/dashboard",
  "/reports",
  "/fraud-detection",
]);
const userAllowed = new Set<string>([
  "/onboarding",
  "/payments",
  "/settings",
]);

function isAllowed(path: string): 'admin' | 'user' | 'none' {
  // Exact matches first, then prefix for nested routes
  const p = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  const startsIn = (set: Set<string>) => Array.from(set).some((k) => p === k || p.startsWith(k + '/'));
  if (startsIn(adminOnly)) return 'admin';
  if (startsIn(userAllowed)) return 'user';
  return 'none';
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const roleNeeded = isAllowed(pathname);
    if (publicPaths.has(pathname)) return;

    // Require login for any non-public path
    if (!token) {
      router.replace('/login');
      return;
    }

    const roles = getRoles();
    const isAdmin = roles.includes('admin');

    if (roleNeeded === 'admin' && !isAdmin) {
      // Regular users attempting admin pages → redirect to first allowed
      router.replace('/onboarding');
      return;
    }

    if (roleNeeded === 'none') {
      // If a route isn't categorized, default to admin-only to be safe
      if (!isAdmin) router.replace('/onboarding');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
