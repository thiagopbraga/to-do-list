import { Board } from './components/Board'
import { Toolbar } from './components/Toolbar'

export default function App() {
  return (
    <div className="flex h-svh w-full flex-col overflow-hidden">
      <Toolbar />
      <Board />
    </div>
  )
}
