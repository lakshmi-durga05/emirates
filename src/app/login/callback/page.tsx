"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken, getRoles } from '@/lib/auth';

export default function LoginCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setError('Missing authorization code.');
      return;
    }
    const run = async () => {
      try {
        const redirectUri = `${window.location.origin}/login/callback`;
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        });
        if (!res.ok) throw new Error('Token exchange failed');
        const data = await res.json();
        if (!data?.access_token) throw new Error('No access token in response');
        setToken(data.access_token);
        const roles = getRoles();
        if (roles.includes('admin')) router.replace('/');
        else router.replace('/accounts');
      } catch (e: any) {
        setError(e?.message || 'Login failed');
      }
    };
    run();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-sm text-muted-foreground">
        {error ? `Error: ${error}` : 'Signing you in...'}
      </div>
    </div>
  );
}
