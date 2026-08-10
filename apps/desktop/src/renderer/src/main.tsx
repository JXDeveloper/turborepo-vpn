import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ClerkProvider } from '@clerk/electron/react'
import { passkeys } from '@clerk/electron/passkeys'

// import { ui } from '@clerk/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} passkeys={passkeys}>
      <App />
    </ClerkProvider>
  </StrictMode>
)
