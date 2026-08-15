import { Show, UserButton } from '@clerk/electron/react'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const RootLayout = () => (
  <>
    <div className="p-2 flex gap-2">
      <Link to="/" className="[&.active]:font-bold">
        Home
      </Link>
      <Show when="signed-out">
        <Link to="/sign-in" className="[&.active]:font-bold">
          Sign In
        </Link>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
    <hr />
    <Outlet />
    <TanStackRouterDevtools />
  </>
)

export const Route = createRootRoute({ component: RootLayout })
