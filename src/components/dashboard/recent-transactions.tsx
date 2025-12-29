"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { useAtlasRealtime } from "@/hooks/useAtlasRealtime";

export function RecentTransactions() {
  const { recent } = useAtlasRealtime();
  return (
    <div className="space-y-8">
      {recent.map((transaction, index) => (
        <div className="flex items-center" key={index}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={`https://picsum.photos/seed/user${index+2}/100/100`} alt="Avatar" data-ai-hint="person" />
            <AvatarFallback>{transaction.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{transaction.name}</p>
            <p className="text-sm text-muted-foreground">{transaction.email}</p>
          </div>
          <div className={`ml-auto font-medium ${transaction.amount.startsWith('-') ? 'text-destructive' : 'text-emerald-600'}`}>{transaction.amount}</div>
        </div>
      ))}
    </div>
  )
}
