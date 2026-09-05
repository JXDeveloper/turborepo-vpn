import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/regions')({
  component: Regions
})

function Regions() {
  return (
    <div>
      <h1>Regions</h1>
    </div>
  )
}
