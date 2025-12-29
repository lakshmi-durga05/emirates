"use client";

import { useEffect, useRef, useState } from 'react';

type SeriesPoint = { name: string; total: number };
type Metrics = {
  transactions: number;
  totalVolume: number;
  activeAccounts?: number;
  series?: SeriesPoint[];
};

type RecentTx = {
  name: string;
  email: string;
  amount: string;
};

type FraudAlert = {
  eventId: string;
  at: string;
  riskScore: number;
  isFraudulent: boolean;
};

const gatewayUrl = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');

export function useAtlasRealtime(initialTx: RecentTx[] = []) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<RecentTx[]>(initialTx);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (esRef.current) return; // singleton per component lifecycle
    const es = new EventSource(`${gatewayUrl}/api/events`);
    esRef.current = es;

    es.addEventListener('metrics', (e: MessageEvent) => {
      try { setMetrics(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener('transaction', (e: MessageEvent) => {
      try { const t = JSON.parse(e.data); setRecent(prev => [t, ...prev].slice(0, 10)); } catch {}
    });
    es.addEventListener('fraud_alert', (e: MessageEvent) => {
      try { const a = JSON.parse(e.data); setAlerts(prev => [a, ...prev].slice(0, 20)); } catch {}
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { metrics, recent, alerts };
}
