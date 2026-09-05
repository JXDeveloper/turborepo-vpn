import { cn } from "cn"

import { useSidebar } from "@renderer/components/ui/sidebar"

type MetroVpnLogoProps = React.ComponentProps<"div">

export function MetroVpnLogo({ className, ...props }: MetroVpnLogoProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <div
      aria-label="Metro VPN"
      className={cn(
        "flex h-8 items-center font-semibold text-sidebar-foreground",
        isCollapsed
          ? "w-8 justify-center rounded-full bg-sidebar-accent text-xs"
          : "px-2 text-base",
        className
      )}
      {...props}
    >
      {isCollapsed ? "MV" : "Metro VPN"}
    </div>
  )
}
