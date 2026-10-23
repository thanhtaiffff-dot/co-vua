// Lớp bọc nhỏ để dùng bàn cờ chessground (của lichess) trong React.
import { useEffect, useRef } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { useShown3d } from '../theme'

type Props = {
  config: Config
  // `premove`: nước này là nước đi trước (đặt sẵn lúc đối thủ còn nghĩ), vừa được tự đi.
  onMove: (from: Key, to: Key, premove: boolean) => void
}

export function Board({ config, onMove }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)
  const threeD = useShown3d()

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
        events: { after: (from, to, meta) => onMoveRef.current(from, to, meta.premove) },
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

  // Quân 3D nhô lên che bớt ô phía sau, nên quân hàng gần người xem phải vẽ đè lên quân hàng xa. Bật, tắt kiểu đó thì
  // vẽ lại cả bàn cho thứ tự áp vào mọi quân.
  useEffect(() => {
    const board = api.current
    if (!board || board.state.addPieceZIndex === threeD) return
    board.set({ addPieceZIndex: threeD })
    board.redrawAll()
  }, [threeD])

  useEffect(() => {
    const board = api.current
    if (!board) return
    board.set(config)
    // Chơi online: vừa tới lượt mình mà có nước đi trước đang chờ thì đi luôn, nếu nước đó vẫn hợp lệ
    // (quân bị ăn mất, hay ô đích bị chắn thì nước đó tự huỷ). Giống chess.com và lichess.
    if (config.premovable?.enabled && config.turnColor === config.movable?.color) board.playPremove()
  }, [config])

  return <div ref={el} className="board" />
}
