"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRoles } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  FileText,
  Settings,
  UserPlus,
  Banknote,
} from 'lucide-react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';

const AtlasIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 text-sidebar-primary"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );


export function SidebarNav() {
  const pathname = usePathname();

  // Avoid hydration mismatch: don't read roles until mounted
  const [mounted, setMounted] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    const roles = getRoles();
    setIsAdmin(roles.includes('admin'));
  }, []);

  // For regular users: show only Onboarding and Payments (per requirement)
  const userItems = [
    { href: '/onboarding', label: 'Onboarding', icon: UserPlus },
    { href: '/payments', label: 'Payments', icon: Banknote },
  ];
  const adminItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/accounts', label: 'Accounts', icon: Users },
    { href: '/onboarding', label: 'Onboarding', icon: UserPlus },
    { href: '/payments', label: 'Payments', icon: Banknote },
    { href: '/fraud-detection', label: 'Fraud Detection', icon: ShieldAlert },
    { href: '/reports', label: 'Reports', icon: FileText },
  ];
  const raw = mounted ? (isAdmin ? [...adminItems] : userItems) : [];
  const seen = new Set<string>();
  const menuItems = raw.filter(item => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <AtlasIcon />
          <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Atlas
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                asChild
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
         <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === '/settings'}
                asChild
                tooltip="Settings"
              >
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
