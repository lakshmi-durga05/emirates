"use client";
import { MainLayout } from '@/components/layout/main-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilePlus } from 'lucide-react';
import { useEffect, useState } from 'react';

type Account = {
  accountNumber: string;
  customerName: string;
  balance: number;
  status: string;
  accountType?: string;
  createdAt?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active':
            return 'default';
        case 'Dormant':
            return 'secondary';
        case 'Closed':
            return 'destructive';
        default:
            return 'outline';
    }
};


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Account | null>(null);

  useEffect(() => {
    const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
    let aborted = false;

    const load = async () => {
      try {
        const res = await fetch(`${gateway}/api/accounts`, { cache: 'no-store' });
        if (!aborted && res.ok) {
          const data = await res.json();
          setAccounts(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    // Initial load
    load();

    // Live updates via SSE: refresh on transaction events
    const es = new EventSource(`${gateway}/api/events`);
    es.addEventListener('transaction', () => {
      load();
    });
    // Fallback: also refresh on metrics events (covers some flows)
    es.addEventListener('metrics', () => {
      load();
    });

    return () => {
      aborted = true;
      es.close();
    };
  }, []);
  return (
    <MainLayout>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Customer Accounts</CardTitle>
                    <CardDescription>
                        Manage and monitor all customer accounts.
                    </CardDescription>
                </div>
                <Button>
                    <FilePlus className="mr-2 h-4 w-4" />
                    New Account
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Account Number</TableHead>
                            <TableHead>Customer Name</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loading && accounts.map((account) => (
                            <TableRow key={account.accountNumber}>
                                <TableCell className="font-medium">{account.accountNumber}</TableCell>
                                <TableCell>{account.customerName}</TableCell>
                                <TableCell>
                                  {`$${Number(account.balance ?? 0).toFixed(2)}`}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getBadgeVariant(account.status) as any}>{account.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setSelected(account)}>View</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        {selected && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Full onboarding details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Customer Name</div>
                  <div className="font-medium">{selected.customerName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{selected.email || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{selected.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Account Number</div>
                  <div className="font-medium">{selected.accountNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Account Type</div>
                  <div className="font-medium">{selected.accountType || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{selected.status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Balance</div>
                  <div className="font-medium">{`$${Number(selected.balance ?? 0).toFixed(2)}`}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created At</div>
                  <div className="font-medium">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        )}
    </MainLayout>
  );
}
