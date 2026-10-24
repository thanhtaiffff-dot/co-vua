// Thẻ kết quả khi hết ván (thay cho ô "1–0" trước đây): ai thắng và vì sao, nút xem lại từng nước, nút mở ván trên
// lichess để máy chấm xem mình đi hay, đi dở chỗ nào, và "Thống kê ván" (đóng sẵn, ai cần thì mở).
import type { Chess, Color } from 'chess.js'
import { analysisUrl, winnerOf, type GameResult } from '../game/rules'
import { GameStats } from './GameStats'
import { Piece } from './Piece'

type Props = {
  result: GameResult
  name: (color: Color) => string // tên trong câu "… thắng" (chơi online: mình là "Bạn")
  playerName?: (color: Color) => string // tên ở bảng thống kê; mặc định như `name`
  chess: Chess // cả ván
  sans: string[]
  times: (number | null)[]
  clocks: Record<Color, number> | null // giờ còn lại lúc hết ván (ván tính giờ)
  orientation: 'white' | 'black'
  shown: number // bàn cờ đang hiện thế cờ sau nước thứ mấy
  onGo: (ply: number) => void // cho bàn cờ hiện thế cờ sau nước `ply` (0 là đầu ván)
}

const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

function reason(result: GameResult, name: (color: Color) => string): string {
  switch (result.kind) {
    case 'checkmate':
      return 'Chiếu bí'
    case 'timeout':
      return `${name(other(result.winner))} hết giờ`
    case 'resign':
      return `${name(other(result.winner))} đầu hàng`
    case 'timeoutDraw':
      return `${name(result.flagged)} hết giờ, nhưng ${name(other(result.flagged))} không còn đủ quân để chiếu bí`
    case 'agreed':
      return 'Hai bên đồng ý hòa'
    case 'stalemate':
      return 'Hết nước đi mà không bị chiếu (pat)'
    case 'insufficient':
      return 'Không còn đủ quân để chiếu bí'
    case 'threefold':
      return 'Lặp lại thế cờ 3 lần'
    case 'fifty':
      return '50 nước không ăn quân, không đi tốt'
    case 'aborted':
      return 'Chưa ai đi quá một nước nên không tính'
    case 'playing':
      return ''
  }
}

export function ResultCard({ result, name, playerName = name, chess, sans, times, clocks, orientation, shown, onGo }: Props) {
  const winner = winnerOf(result)
  const title = winner ? `${name(winner)} thắng` : result.kind === 'aborted' ? 'Ván đã huỷ' : 'Hòa'

  return (
    <div className={`result result--${winner ? 'win' : result.kind === 'aborted' ? 'aborted' : 'draw'}`} role="status">
      <div className="result__head">
        {result.kind !== 'aborted' && (
          <span className={`cg-wrap result__badge${winner ? '' : ' result__badge--draw'}`} aria-hidden="true">
            {winner ? (
              <Piece type="k" color={winner} />
            ) : (
              <>
                <Piece type="k" color="w" />
                <Piece type="k" color="b" />
              </>
            )}
          </span>
        )}
        <div className="result__heading">
          <p className="result__title">{title}</p>
          <p className="result__reason">{reason(result, name)}</p>
        </div>
      </div>

      {sans.length > 0 && (
        <>
          <div className="result__actions">
            <button type="button" className="btn" onClick={() => onGo(0)}>
              Xem lại từng nước
            </button>
            <a className="btn" href={analysisUrl(sans, orientation)} target="_blank" rel="noopener noreferrer">
              Phân tích trên lichess ↗
            </a>
          </div>
          <GameStats chess={chess} sans={sans} times={times} clocks={clocks} name={playerName} shown={shown} onGo={onGo} />
        </>
      )}
    </div>
  )
}
