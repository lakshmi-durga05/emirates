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
import { UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

export default function OnboardingPage() {
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
    const firstName = (form.querySelector('#firstName') as HTMLInputElement)?.value?.trim();
    const lastName = (form.querySelector('#lastName') as HTMLInputElement)?.value?.trim();
    const email = (form.querySelector('#email') as HTMLInputElement)?.value?.trim();
    const phone = (form.querySelector('#phone') as HTMLInputElement)?.value?.trim();
    const accountType = (form.querySelector('#account-type') as HTMLSelectElement | HTMLInputElement)?.value || 'current';
    const initialDepositStr = (form.querySelector('#initial-deposit') as HTMLInputElement)?.value?.trim();
    const initialDeposit = Number(initialDepositStr || '0');
    if (!firstName || !lastName || !email) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${gateway}/api/onboarding`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, accountType, initialDeposit })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Onboarding failed: ${data.error || res.statusText}`);
      } else {
        alert(`Onboarded. Account: ${data.accountNumber}`);
        form.reset();
      }
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>New Customer Onboarding</CardTitle>
            <CardDescription>
              Securely onboard a new customer in compliance with KYC/AML regulations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-8" onSubmit={onSubmit}>
              <div>
                <h3 className="text-lg font-medium">Personal Information</h3>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="john.doe@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+971 50 123 4567" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium">Identity Verification</h3>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="id-type">ID Type</Label>
                        <Select>
                            <SelectTrigger id="id-type">
                                <SelectValue placeholder="Select ID type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="emirates-id">Emirates ID</SelectItem>
                                <SelectItem value="passport">Passport</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="id-number">ID Number</Label>
                        <Input id="id-number" placeholder="784-1234-567890-1" />
                    </div>
                    <div className="col-span-full space-y-2">
                        <Label htmlFor="id-upload">Upload ID Document</Label>
                        <Input id="id-upload" type="file" className="pt-2"/>
                        <p className="text-xs text-muted-foreground">Front and back of the document. PDF, PNG, JPG accepted.</p>
                    </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium">Account Setup</h3>
                <Separator className="my-4" />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="account-type">Account Type</Label>
                        <Select>
                            <SelectTrigger id="account-type">
                                <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="current">Current Account</SelectItem>
                                <SelectItem value="savings">Savings Account</SelectItem>
                                <SelectItem value="investment">Investment Account</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="initial-deposit">Initial Deposit (USD)</Label>
                        <Input id="initial-deposit" type="number" placeholder="1000.00" />
                    </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" size="lg" disabled={submitting}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Onboard Customer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
