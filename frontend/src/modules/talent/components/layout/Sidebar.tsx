'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { AnimateIcon } from '@/components/ui/AnimateIcon';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles: string[];
  permissionKey?: string; // Maps to permission feature key
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', roles: ['super_admin', 'admin', 'hiring_manager', 'interviewer'], permissionKey: 'dashboard' },
  { icon: Briefcase, label: 'Demands', href: '/demands', roles: ['super_admin', 'admin', 'hiring_manager', 'interviewer'], permissionKey: 'demands' },
  { icon: ClipboardList, label: 'Candidates', href: '/candidates', roles: ['super_admin', 'admin', 'hiring_manager', 'interviewer'], permissionKey: 'candidates' },
  { icon: Calendar, label: 'Interviews', href: '/interviews', roles: ['super_admin', 'admin', 'hiring_manager', 'interviewer'], permissionKey: 'interviews' },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });



  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin (HR)',
      hiring_manager: 'Hiring Manager',
      interviewer: 'Interviewer',
    };
    return roleNames[role] || role;
  };

  return (
    <aside
      className={cn(
        'h-full flex flex-col transition-all duration-300 border-r border-white/5',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{ background: 'linear-gradient(180deg, #0A2A43, #0F3B63)' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center">
            <img
              src="/guhatek.png"
              alt="GuhaTek"
              className="h-14 w-auto object-contain brightness-0 invert"
            />
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center mx-auto">
            <img
              src="/guhatek.png"
              alt="G"
              className="h-10 w-10 object-contain brightness-0 invert"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent hidden lg:flex ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'gradient-accent text-white shadow-md'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="bg-card text-card-foreground border">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                <span className="text-sidebar-primary font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.role && getRoleDisplayName(user.role)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="flex-1 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent group"
              >
                <AnimateIcon animateOnHover animation="spin" className="mr-2">
                  <Settings className="h-4 w-4" />
                </AnimateIcon>
                Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="flex-1 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent group"
                >
                  <AnimateIcon animateOnHover animation="spin">
                    <Settings className="h-5 w-5" />
                  </AnimateIcon>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card text-card-foreground border">
                Settings
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card text-card-foreground border">
                Sign Out
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside >
  );
};
