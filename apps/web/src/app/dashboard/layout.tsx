import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-slate-950 text-slate-100">
        <SidebarTrigger className="fixed top-3 left-3 z-20 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white md:hidden" />
        <div className="mx-auto w-full max-w-6xl px-5 py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
