import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@ensdomains/thorin'
import { WagmiProvider } from 'wagmi'
import '@ensdomains/thorin/dist/thorin.css'
import './App.css'
import { LeftPane } from './components/LeftPane'
import { RightPane } from './components/RightPane'
import { wagmiConfig } from './lib/wagmi'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <h1>Auto-renew</h1>
          <main className="demo-layout">
            <LeftPane />
            <RightPane />
          </main>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
