import { Show, useAuth } from '@clerk/electron/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { Link } from '@tanstack/react-router'
import { Button } from '@renderer/components/ui/button'
export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn) {
      void navigate({ to: '/dashboard', replace: true })
    }
  }, [isSignedIn, navigate])
  return (
    <div>
      <Show when="signed-out">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6">
          <h1>Welcome to Metro VPN!</h1>
          <div className="flex gap-4">
            <Button>
              <Link to="/sign-up">Sign Up</Link>
            </Button>
            <Button>
              <Link to="/sign-in">Sign In</Link>
            </Button>
          </div>
        </main>
      </Show>
    </div>
  )
}
