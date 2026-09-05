import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SidebarProvider, SidebarTrigger } from '@renderer/components/ui/sidebar'
import AppSidebar from '@renderer/components/app-sidebar'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout
})

function DashboardLayout() {
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <main>
          <SidebarTrigger />
          <Outlet />
        </main>
      </SidebarProvider>
    </>
  )
}
