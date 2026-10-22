import { useCallback, useEffect, useRef, useState } from 'react'
import type { Backend } from './backend'
import type { Connection, ConnectionStatus } from './connection'
import { myToken } from './identity'
import type { ClientMessage, RoomView } from './protocol'

export type RoomState = {
  room: RoomView | null // tình hình phòng máy chủ báo gần nhất
  receivedAt: number // lúc nhận được tình hình đó, theo giờ máy này (để đồng hồ chạy tiếp cho đúng)
  status: ConnectionStatus
  missing: boolean // máy chủ báo không có phòng này
  send: (message: ClientMessage) => void
  lag: () => number
}

// Nối vào phòng `id` và giữ tình hình mới nhất máy chủ báo về.
export function useRoom(backend: Backend, id: string): RoomState {
  const [latest, setLatest] = useState<{ room: RoomView | null; receivedAt: number }>({ room: null, receivedAt: 0 })
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [missing, setMissing] = useState(false)
  const connection = useRef<Connection | null>(null)

  useEffect(() => {
    const opened = backend.connect(id, myToken(), {
      message(message) {
        if (message.t === 'error') setMissing(true)
        else setLatest({ room: message.room, receivedAt: Date.now() })
      },
      status: setStatus,
    })
    connection.current = opened
    return () => {
      opened.close()
      connection.current = null
    }
  }, [backend, id])

  const send = useCallback((message: ClientMessage) => connection.current?.send(message), [])
  const lag = useCallback(() => connection.current?.lag() ?? 0, [])
  return { ...latest, status, missing, send, lag }
}
