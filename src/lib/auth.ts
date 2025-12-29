"use client";

// Minimal client-side auth helper. Supports two modes:
// - Local mock auth (no Keycloak): users stored in localStorage, dummy JWT created
// - OIDC redirect helpers (kept, but not used when local auth is preferred)

const TOKEN_KEY = "atlas_token";
const ROLES_KEY = "atlas_roles";
const USERS_KEY = "atlas_local_users"; // [{username, password, roles}]
const CURRENT_USER_KEY = "atlas_current_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    const roles: string[] = payload?.realm_access?.roles || [];
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  } catch {}
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLES_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getRoles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasRole(role: string): boolean {
  return getRoles().includes(role);
}

export function beginLogin() {
  // Authorization Code flow redirect (no CORS issues)
  const redirectUri = encodeURIComponent(`${window.location.origin}/login/callback`);
  const authUrl = `http://localhost:8443/realms/atlas/protocol/openid-connect/auth?client_id=atlas-gateway&response_type=code&redirect_uri=${redirectUri}`;
  window.location.href = authUrl;
}

export function logout() {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ---------- Local Mock Auth (no Keycloak) ----------
type LocalUser = { username: string; password: string; roles: string[]; email?: string; role?: 'user' | 'customer' };

function loadUsers(): LocalUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as LocalUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerLocalUser(username: string, password: string, email?: string, role: 'user' | 'customer' = 'user'): boolean {
  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return false;
  const roles = role === 'user' || role === 'customer' ? ['user'] : ['user'];
  users.push({ username, password, roles, email, role });
  saveUsers(users);
  if (typeof window !== 'undefined') localStorage.setItem(CURRENT_USER_KEY, username);
  return true;
}

export function localLogin(username: string, password: string, desiredRole?: 'user' | 'customer'): boolean {
  // Built-in admin
  if (username === 'admin' && password === 'admin') {
    issueDummyToken(['admin']);
    if (typeof window !== 'undefined') localStorage.setItem(CURRENT_USER_KEY, username);
    return true;
  }
  const users = loadUsers();
  const u = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!u) return false;
  if (desiredRole && u.role && desiredRole !== u.role) return false;
  issueDummyToken(u.roles);
  if (typeof window !== 'undefined') localStorage.setItem(CURRENT_USER_KEY, username);
  return true;
}

function issueDummyToken(roles: string[]) {
  // Create a tiny unsigned JWT-like token carrying roles in realm_access.roles
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ realm_access: { roles } }));
  const token = `${header}.${payload}.`;
  setToken(token);
}

export function getCurrentUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_USER_KEY);
}
