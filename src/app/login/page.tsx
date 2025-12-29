"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { localLogin, getRoles } from '@/lib/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'user'|'customer'>('user');
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!username || !password) {
      setError('Please enter username and password');
      setLoading(false);
      return;
    }
    const ok = localLogin(username.trim(), password, role);
    if (!ok) {
      setError('Invalid username or password');
      setLoading(false);
      return;
    }
    const roles = getRoles();
    if (roles.includes('admin')) router.replace('/');
    else router.replace('/onboarding');
  };

  const goToSignup = () => router.push('/signup');
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="grid w-full max-w-5xl grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="text-white hidden md:block">
          <h1 className="text-4xl font-bold mb-4">ATLAS</h1>
          <p className="text-slate-300 mb-6">Regulator-grade core banking and payments platform.</p>
          <Button variant="secondary" onClick={() => setShowMore(v => !v)}>Learn More</Button>
          {showMore && (
            <div className="mt-4 max-w-md text-slate-200 text-sm space-y-2">
              <p>• Real-time payments with fraud checks and an auditable ledger.</p>
              <p>• Role-based access: administrators monitor dashboards and reports, users make payments and onboarding.</p>
              <p>• Built with Kafka, Postgres, MongoDB, Redis, and secure-by-design practices.</p>
            </div>
          )}
        </div>
        <Card className="w-full max-w-md mx-auto md:ml-auto">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Use your ATLAS credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">User Name</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v)=>setRole(v as 'user'|'customer')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Submit'}</Button>
              <div className="text-sm text-center text-muted-foreground">
                Don’t have an account? <button type="button" className="underline" onClick={goToSignup}>Sign Up</button>
              </div>
              <p className="text-xs text-muted-foreground">Admin: admin / admin</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
