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
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PaymentsPage() {
  const [submitting, setSubmitting] = useState(false);
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardTypeSel, setCardTypeSel] = useState<string>('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fromAccount = (form.querySelector('#sender') as HTMLInputElement)?.value?.trim();
    const toAccount = (form.querySelector('#receiver') as HTMLInputElement)?.value?.trim();
    const amountStr = (form.querySelector('#amount') as HTMLInputElement)?.value?.trim();
    const amount = Number(amountStr);
    const remarks = (form.querySelector('#remarks') as HTMLTextAreaElement)?.value?.trim();
    const complaints = (form.querySelector('#complaints') as HTMLTextAreaElement)?.value?.trim();
    const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
    if (!fromAccount || !toAccount || !amount) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${gateway}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccount, toAccount, amount, currency: 'USD', remarks, complaints })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Payment failed: ${err.error || res.statusText}`);
      } else {
        const data = await res.json();
        alert(`Payment accepted. Event ID: ${data.eventId}`);
        form.reset();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCardSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const cardType = cardTypeSel;
    const cardNumber = (form.querySelector('#cardNumber') as HTMLInputElement)?.value?.trim();
    const expiry = (form.querySelector('#expiry') as HTMLInputElement)?.value?.trim();
    const cvv = (form.querySelector('#cvv') as HTMLInputElement)?.value?.trim();
    const amount = Number((form.querySelector('#cardAmount') as HTMLInputElement)?.value?.trim());
    const merchant = (form.querySelector('#merchant') as HTMLInputElement)?.value?.trim() || 'Demo Merchant';
    const fromAccount = (form.querySelector('#senderCard') as HTMLInputElement)?.value?.trim() || 'ACC001';
    const toAccount = (form.querySelector('#merchantAcc') as HTMLInputElement)?.value?.trim() || 'MERCHANT-SETTLEMENT';
    const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
    if (!cardType || !cardNumber || !expiry || !cvv || !amount) return;
    setCardSubmitting(true);
    try {
      const res = await fetch(`${gateway}/api/cards/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType, cardNumber, expiry, cvv, amount, currency: 'USD', merchant, fromAccount, toAccount })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Card authorization failed: ${data.error || res.statusText}`);
      } else if (data.status === 'APPROVED') {
        alert(`Approved. Event ID: ${data.eventId}`);
        form.reset();
      } else {
        alert(`Declined. Risk=${data.riskScore} Reason=${data.reason}`);
      }
    } finally {
      setCardSubmitting(false);
    }
  }
  return (
    <MainLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Real-Time Payment</CardTitle>
                    <CardDescription>
                        Initiate a secure real-time payment.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-6" onSubmit={onSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sender">Sender Account</Label>
                                <Input id="sender" placeholder="ACC001" defaultValue="ACC001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="receiver">Receiver Account</Label>
                                <Input id="receiver" placeholder="Enter receiver account number" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (USD)</Label>
                            <Input id="amount" type="number" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <Textarea id="remarks" placeholder="Optional payment details" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="complaints">Any complaints</Label>
                            <Textarea id="complaints" placeholder="Describe any issues or complaints (optional)" />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={submitting}>
                                <Send className="mr-2 h-4 w-4" />
                                {submitting ? 'Processing...' : 'Send Payment'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Card Payment</CardTitle>
                    <CardDescription>
                        Authorize a card transaction (CVV is never stored).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-6" onSubmit={onCardSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cardType">Card Type</Label>
                                <Select value={cardTypeSel} onValueChange={setCardTypeSel}>
                                  <SelectTrigger id="cardType">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Debit Card">Debit Card</SelectItem>
                                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                                    <SelectItem value="Virtual Card">Virtual Card</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cardNumber">Card Number</Label>
                                <Input id="cardNumber" placeholder="4111 1111 1111 1234" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiry">Expiry (MM/YY)</Label>
                                <Input id="expiry" placeholder="12/28" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvv">CVV</Label>
                                <Input id="cvv" type="password" placeholder="***" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cardAmount">Amount (USD)</Label>
                                <Input id="cardAmount" type="number" placeholder="0.00" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="merchant">Merchant Name</Label>
                                <Input id="merchant" placeholder="Demo Merchant" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="senderCard">Settlement From (optional)</Label>
                                <Input id="senderCard" placeholder="ACC001" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="merchantAcc">Settlement To (optional)</Label>
                            <Input id="merchantAcc" placeholder="MERCHANT-SETTLEMENT" />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={cardSubmitting}>
                                <Send className="mr-2 h-4 w-4" />
                                {cardSubmitting ? 'Authorizing...' : 'Authorize Card Payment'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Payment Rails</CardTitle>
                    <CardDescription>Supported Networks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <span className="font-medium">SWIFT</span>
                        <Badge variant="default">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <span className="font-medium">FedWire</span>
                        <Badge variant="default">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <span className="font-medium">ACH</span>
                        <Badge variant="default">Active</Badge>
                    </div>
                     <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <span className="font-medium">Crypto (BTC/ETH)</span>
                        <Badge variant="secondary">Upcoming</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </MainLayout>
  );
}
