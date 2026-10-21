// Hình quân cờ nhỏ, mượn đúng bộ hình đang dùng trên bàn cờ (cburnett).
import type { Color, PieceSymbol } from 'chess.js'

const ROLE: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      piece: HTMLAttributes<HTMLElement>
    }
  }
}

export function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  return <piece className={`${ROLE[type]} ${color === 'w' ? 'white' : 'black'}`} />
}
