import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { BellRing, Search, Menu, Shield, ChevronDown } from 'lucide-react';
import { AnimateIcon } from '@/components/ui/AnimateIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/types/recruitment';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export const Header = ({ title, onMenuClick }: HeaderProps) => {
  const { user, switchRole } = useAuth();
  const { notifications, unreadCount } = useNotifications();

  const roles: { value: UserRole; label: string; description?: string }[] = [
    { value: 'super_admin', label: 'Super Admin', description: 'Full system access' },
    { value: 'admin', label: 'Admin (HR)', description: 'Recruitment & Offers' },
    { value: 'hiring_manager', label: 'Hiring Manager', description: 'Demands & Candidates' },
    { value: 'interviewer', label: 'Interviewer', description: 'Conduct Interviews' },
  ];

  // All roles available for switching
  const availableRoles = roles;

  return (
    <header className="h-16 border-b border-white/5 px-4 lg:px-6 flex items-center justify-between shadow-sm" style={{ background: 'linear-gradient(90deg, #0B4F8A, #0D77B7, #0FA0D5)' }}>
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden text-white hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* Search */}
        <div className="flex relative items-center max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search candidates, demands..."
            className="pl-10 w-full border-white/5 text-white placeholder:text-white/30 focus-visible:ring-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">

        {/* Role Switcher - Visible for roles with switching permissions (super_admin, admin, hiring_manager) */}


        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative group text-white hover:bg-white/10">
              <AnimateIcon animateOnHover>
                <BellRing className="h-5 w-5" />
              </AnimateIcon>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <p>No new notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => {
                      if (notification.type === 'demand') {
                        window.location.href = '/demands';
                      } else {
                        window.location.href = '/interviews';
                      }
                    }}
                    className={`cursor-pointer p-3 flex flex-col items-start mb-1 last:mb-0 border-l-4 ${notification.type === 'interview' ? 'border-l-blue-500' : 'border-l-emerald-500'
                      } !bg-transparent !hover:bg-transparent !focus:bg-transparent !text-foreground !focus:text-foreground !hover:text-foreground outline-none ring-0`}
                  >
                    <div className="font-medium text-sm">{notification.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{notification.subtitle}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 self-end">{notification.time}</div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
