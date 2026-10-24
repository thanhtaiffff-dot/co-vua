// Lớp bọc nhỏ để dùng bàn cờ chessground (của lichess) trong React.
import { useEffect, useRef } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { useShown3d } from '../theme'

type Props = {
  config: Config
  onMove: (from: Key, to: Key) => void
  // Chơi online, lúc đối thủ đang nghĩ: người chơi kéo quân là đặt sẵn một nước đi trước. Bàn cờ không tự giữ nước đó
  // (chessground chỉ giữ được một nước): trang tự xếp hàng các nước, rồi vẽ quân ở chỗ mới qua `config`.
  onPremove?: (from: Key, to: Key) => void
  // Chạm ô trống (không phải để chọn quân, đặt nước) lúc có nước đi trước đang chờ: huỷ hết các nước đó.
  onPremoveCancel?: () => void
}

export function Board({ config, onMove, onPremove, onPremoveCancel }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const handlers = useRef({ onMove, onPremove, onPremoveCancel })
  const threeD = useShown3d()

  useEffect(() => {
    handlers.current = { onMove, onPremove, onPremoveCancel }
  }, [onMove, onPremove, onPremoveCancel])

  // Tạo bàn cờ một lần khi component xuất hiện, dọn đi khi biến mất.
  useEffect(() => {
    const host = el.current
    if (!host) return
    const board = Chessground(host, {
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: true, showGhost: true },
      premovable: {
        enabled: false,
        events: {
          set: (from, to) => {
            board.cancelPremove()
            handlers.current.onPremove?.(from, to)
          },
        },
      },
      movable: {
        free: false,
        showDests: true,
        events: { after: (from, to) => handlers.current.onMove(from, to) },
      },
    })
    api.current = board

    // Chạm vào bàn lúc đang chờ lượt: chạm quân mình (để đặt thêm nước đi trước), hay chạm ô đích của quân đang chọn,
    // thì để bàn cờ lo; chạm chỗ khác là huỷ các nước đi trước. Xét ngay lúc vừa chạm, trước khi bàn cờ đổi quân đang chọn.
    function tap(event: PointerEvent) {
      const state = board.state
      if (!handlers.current.onPremoveCancel || !state.premovable.enabled || state.turnColor === state.movable.color) return
      const key = board.getKeyAtDomPos([event.clientX, event.clientY])
      if (!key) return
      const piece = state.pieces.get(key)
      if (piece && piece.color === state.movable.color) return
      if (state.selected && state.premovable.dests?.includes(key)) return
      handlers.current.onPremoveCancel()
    }
    host.addEventListener('pointerdown', tap, { capture: true })

    // Bàn cờ cần tính lại kích thước khi màn hình xoay hoặc đổi cỡ.
    const resize = new ResizeObserver(() => board.redrawAll())
    resize.observe(host)
    return () => {
      host.removeEventListener('pointerdown', tap, { capture: true })
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
    api.current?.set(config)
  }, [config])

  return <div ref={el} className="board" />
}
