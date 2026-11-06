import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './index.css'
import { Root } from './Root.tsx'
// Chất liệu kiểu Titan nạp sau cùng, sau CSS của mọi trang, để phủ lên.
import './titan.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
