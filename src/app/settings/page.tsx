"use client";
import { MainLayout } from '@/components/layout/main-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';
import { getCurrentUsername } from '@/lib/auth';

type Profile = { name: string; email: string };

function loadProfile(username: string | null): Profile {
  if (!username) return { name: '', email: '' };
  try {
    const raw = localStorage.getItem(`atlas_profile_${username}`);
    return raw ? JSON.parse(raw) as Profile : { name: '', email: '' };
  } catch {
    return { name: '', email: '' };
  }
}

function saveProfile(username: string | null, p: Profile) {
  if (!username) return;
  localStorage.setItem(`atlas_profile_${username}`, JSON.stringify(p));
}

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getCurrentUsername();
    const p = loadProfile(u);
    setName(p.name || (u === 'admin' ? 'Admin' : ''));
    setEmail(p.email || (u === 'admin' ? 'admin@atlas.ae' : ''));
  }, []);

  const onSave = () => {
    const u = getCurrentUsername();
    saveProfile(u, { name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Manage your administrator profile details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e)=>setName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={onSave}>Update Profile</Button>
              {saved && <span className="text-sm text-muted-foreground">Saved</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure how you receive notifications from the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="fraud-alerts" className="font-medium">Fraud Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive real-time email alerts for high-risk transactions.</p>
              </div>
              <Switch id="fraud-alerts" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="system-updates" className="font-medium">System Updates</Label>
                <p className="text-sm text-muted-foreground">Get notified about new features and platform maintenance.</p>
              </div>
              <Switch id="system-updates" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="daily-summary" className="font-medium">Daily Summary</Label>
                <p className="text-sm text-muted-foreground">Receive a daily summary of platform activity.</p>
              </div>
              <Switch id="daily-summary" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
