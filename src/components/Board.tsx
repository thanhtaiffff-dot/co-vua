// Lớp bọc nhỏ để dùng bàn cờ chessground (của lichess) trong React.
import { useEffect, useRef } from 'react'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Config } from 'chessground/config'
import type { Key } from 'chessground/types'

type Props = {
  config: Config
  onMove: (from: Key, to: Key) => void
}

export function Board({ config, onMove }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  // Tạo bàn cờ một lần khi component xuất hiện, dọn đi khi biến mất.
  useEffect(() => {
    if (!el.current) return
    const board = Chessground(el.current, {
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: true, showGhost: true },
      premovable: { enabled: false },
      movable: {
        free: false,
        showDests: true,
        events: { after: (from, to) => onMoveRef.current(from, to) },
      },
    })
    api.current = board
    // Bàn cờ cần tính lại kích thước khi màn hình xoay hoặc đổi cỡ.
    const resize = new ResizeObserver(() => board.redrawAll())
    resize.observe(el.current)
    return () => {
      resize.disconnect()
      board.destroy()
      api.current = null
    }
  }, [])

  useEffect(() => {
    api.current?.set(config)
  }, [config])

  return <div ref={el} className="board" />
}
