"use client";

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  type FraudDetectionOutput,
} from '@/ai/flows/fraud-detection-flow';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  transactionDetails: z.string().min(3, 'Enter sender account number (optionally ",amount").'),
  userProfile: z.string().min(3, 'Enter receiver account number.'),
});

// No default examples; fields start empty to avoid precomputed data.

export default function FraudDetectionClient() {
  const [result, setResult] = useState<FraudDetectionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionDetails: '',
      userProfile: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    try {
      // Support both JSON payloads and plain account numbers in existing fields
      let amount = 0;
      let fromAccount = '';
      let toAccount = '';

      try {
        const tx = JSON.parse(values.transactionDetails);
        amount = Number(tx.amount);
        fromAccount = tx?.sender?.id;
        toAccount = tx?.receiver?.id;
      } catch {
        // If not JSON, interpret "transactionDetails" as a plain string: "FROM_ACCOUNT[,AMOUNT]"
        // and "userProfile" as the TO_ACCOUNT (also plain string). Amount defaults to 25 if omitted.
        const rawFrom = (values.transactionDetails || '').trim();
        const rawTo = (values.userProfile || '').trim();
        const parts = rawFrom.split(',').map(s => s.trim()).filter(Boolean);
        fromAccount = parts[0] || '';
        amount = parts[1] ? Number(parts[1]) : 25;
        toAccount = rawTo;
      }

      if (!fromAccount || !toAccount) throw new Error('Provide valid sender and receiver account numbers.');
      if (!amount || isNaN(amount) || amount <= 0) amount = 25;
      const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
      const res = await fetch(`${gateway}/api/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccount, toAccount, amount, currency: 'USD' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      const eventId = data.eventId;

      // Wait for matching fraud_alert from SSE up to 10s
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${gateway}/api/events`);
        const timer = setTimeout(() => { es.close(); reject(new Error('Timeout waiting for fraud alert')); }, 20000);
        const handler = (e: MessageEvent) => {
          try {
            const alert = JSON.parse(e.data);
            if (alert.eventId === eventId) {
              setResult({ isFraudulent: !!alert.isFraudulent, fraudExplanation: alert.isFraudulent ? 'High risk score flagged by fraud service.' : 'Low risk score observed by fraud service.', riskScore: Number(alert.riskScore) || 0 });
              clearTimeout(timer);
              es.removeEventListener('fraud_alert', handler as any);
              es.close();
              resolve();
            }
          } catch { /* ignore */ }
        };
        es.addEventListener('fraud_alert', handler as any);
      });
    } catch (error) {
      console.error('Fraud detection failed:', error);
      toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Failed to analyze transaction." });
    } finally {
      setIsLoading(false);
    }
  }
  
  const getRiskBadgeVariant = (score: number) => {
    if (score > 75) return 'destructive';
    if (score > 40) return 'secondary';
    return 'default';
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>AI-Powered Fraud Detection</CardTitle>
          <CardDescription>
            Analyze transaction data and user profiles in real-time to identify and prevent fraudulent activities.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="transactionDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sender Account Number [,Amount]</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. ACC170667, 50  (amount optional; defaults to 25)" {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="userProfile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receiver Account Number</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. ACC827243" {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                <Zap className="mr-2 h-4 w-4" />
                {isLoading ? 'Analyzing...' : 'Analyze Transaction'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Result</CardTitle>
          <CardDescription>
            The verdict from our AI fraud detection engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-[150px]" />
                    </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
            </div>
          ) : result ? (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    {result.isFraudulent ? (
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    ) : (
                        <ShieldCheck className="h-10 w-10 text-emerald-600" />
                    )}
                    <div>
                        <h3 className="text-lg font-semibold">
                            {result.isFraudulent ? 'Fraudulent Transaction Detected' : 'Transaction Appears Legitimate'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Based on the provided data analysis.
                        </p>
                    </div>
                </div>

              <div>
                <Label className="text-sm font-medium">Risk Score</Label>
                <div className="flex items-center gap-4 mt-2">
                    <Progress value={result.riskScore} className="w-[60%]" />
                    <Badge variant={getRiskBadgeVariant(result.riskScore) as any}>{result.riskScore} / 100</Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Explanation</Label>
                <p className="text-sm text-muted-foreground mt-2 bg-muted p-4 rounded-md border">
                  {result.fraudExplanation}
                </p>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
              <ShieldAlert className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Submit transaction data to see the analysis result.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
