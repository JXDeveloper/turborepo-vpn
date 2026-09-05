import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/accounts')({
  component: Accounts
})

function Accounts() {
  return (
    <div>
      <h1>Accounts</h1>
    </div>
  )
}
