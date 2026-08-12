import { SignIn } from '@clerk/electron/react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage
})

function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <SignIn />
    </div>
  )
}
