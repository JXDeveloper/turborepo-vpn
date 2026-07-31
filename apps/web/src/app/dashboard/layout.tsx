import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Navbar from "../components/navbar";

const navigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/peers", label: "Peers" },
  { href: "/dashboard/tunnel", label: "Exit node" },
];

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* <header className="border-b border-slate-800 bg-slate-900/80"> */}
      <Navbar>
        <div className="mx-auto flex min-h-8 max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/dashboard" className="font-semibold tracking-tight text-sky-400">
            VPN Control Panel
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <UserButton />
          </nav>
        </div>
        {/* </header> */}
      </Navbar>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
