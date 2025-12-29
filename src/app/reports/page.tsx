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
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ day: string; credits: number; debits: number; closing_balance: number; difference: number; status: string }>>([]);
  const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');

  async function loadRecon() {
    const res = await fetch(`${gateway}/api/reports/reconciliation.json`);
    if (res.ok) {
      const data = await res.json();
      const arr: typeof items = data.items || [];
      // Deduplicate by day to avoid duplicate keys/rows if backend has legacy duplicates
      const unique = new Map<string, (typeof items)[number]>();
      for (const r of arr) {
        if (!unique.has(r.day)) unique.set(r.day, r);
      }
      setItems(Array.from(unique.values()));
    }
  }

  useEffect(() => { loadRecon(); }, []);

  async function runReconciliation() {
    setLoading(true);
    try {
      const res = await fetch(`${gateway}/api/reports/reconciliation/run`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Run failed: ${err.error || res.statusText}`);
      } else {
        await loadRecon();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <Card>
        <CardHeader>
          <CardTitle>Compliance Reporting</CardTitle>
          <CardDescription>
            Generate and download reports compliant with UAE regulations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Monthly Transactions Report</h3>
              <p className="text-sm text-muted-foreground">Monthly totals with transaction count and credited volume.</p>
            </div>
            <Button asChild>
              <a href={`${(process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/reports/monthly.csv`} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Complaints Report</h3>
              <p className="text-sm text-muted-foreground">Payments where users added complaints at the time of payment.</p>
            </div>
            <Button asChild>
              <a href={`${(process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/reports/complaints.csv`} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            </Button>
          </div>

          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Reconciliation</h3>
                <p className="text-sm text-muted-foreground">Compare daily ledger totals with account closing balances.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" asChild>
                  <a href={`${gateway}/api/reports/reconciliation.csv`} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </a>
                </Button>
                <Button onClick={runReconciliation} disabled={loading}>{loading ? 'Running...' : 'Run Reconciliation'}</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Day</th>
                    <th className="py-2 pr-4">Credits</th>
                    <th className="py-2 pr-4">Debits</th>
                    <th className="py-2 pr-4">Closing</th>
                    <th className="py-2 pr-4">Difference</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={`${r.day}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.day}</td>
                      <td className="py-2 pr-4">{Number(r.credits).toFixed(2)}</td>
                      <td className="py-2 pr-4">{Number(r.debits).toFixed(2)}</td>
                      <td className="py-2 pr-4">{Number(r.closing_balance).toFixed(2)}</td>
                      <td className="py-2 pr-4">{Number(r.difference).toFixed(2)}</td>
                      <td className="py-2 pr-4">{r.status}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={6}>No results. Click "Run Reconciliation".</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
