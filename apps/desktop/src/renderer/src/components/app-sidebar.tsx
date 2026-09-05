import { UserButton } from '@clerk/electron/react'
import { Link } from '@tanstack/react-router'
import { CircleUserRound, Home, Map, Settings, type LucideIcon } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@renderer/components/ui/sidebar'

const navigationItems: {
  label: string
  to: '/dashboard' | '/dashboard/accounts' | '/dashboard/regions' | '/dashboard/settings'
  icon: LucideIcon
}[] = [
  { label: 'Home', to: '/dashboard', icon: Home },
  { label: 'Accounts', to: '/dashboard/accounts', icon: CircleUserRound },
  { label: 'Regions', to: '/dashboard/regions', icon: Map },
  { label: 'Settings', to: '/dashboard/settings', icon: Settings }
]

export default function AppSidebar() {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div
          aria-label="Metro VPN"
          className={
            isCollapsed
              ? 'flex size-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground'
              : 'flex h-8 items-center px-2 text-base font-semibold text-sidebar-foreground'
          }
        >
          {isCollapsed ? 'MV' : 'Metro VPN'}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton render={<Link to={item.to} />} tooltip={item.label}>
                  <Icon />
                  {!isCollapsed && <span>{item.label}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className={isCollapsed ? 'flex justify-center' : 'px-2'}>
          <UserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
