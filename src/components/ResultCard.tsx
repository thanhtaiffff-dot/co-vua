// Thẻ kết quả khi hết ván (thay cho ô "1–0" trước đây): ai thắng và vì sao, tóm tắt ván (số nước, thời gian, nước nghĩ
// lâu nhất), nút xem lại từng nước và nút mở ván trên lichess để máy chấm xem mình đi hay, đi dở chỗ nào.
import type { Color } from 'chess.js'
import { formatSpan, formatThink } from '../game/clock'
import { analysisUrl, winnerOf, type GameResult } from '../game/rules'
import { Piece } from './Piece'

type Props = {
  result: GameResult
  name: (color: Color) => string
  sans: string[]
  times: (number | null)[]
  orientation: 'white' | 'black'
  onReview: () => void
  hint?: string
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

export function ResultCard({ result, name, sans, times, orientation, onReview, hint }: Props) {
  const winner = winnerOf(result)
  const title = winner ? `${name(winner)} thắng` : result.kind === 'aborted' ? 'Ván đã huỷ' : 'Hòa'
  // Nước nghĩ lâu nhất, và ván dài bao lâu: cộng thời gian nghĩ các nước (chỉ tính những nước biết thời gian).
  let longest = -1
  let total = 0
  times.forEach((time, i) => {
    if (time === null || time === undefined) return
    total += time
    if (longest < 0 || time > (times[longest] ?? 0)) longest = i
  })
  const moveLabel = (i: number) => `${Math.floor(i / 2) + 1}.${i % 2 ? '..' : ''} ${sans[i]}`

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
        <p className="result__facts">
          {Math.ceil(sans.length / 2)} nước{total > 0 && <> · ván dài {formatSpan(total)}</>}
          {longest >= 0 && (
            <>
              <br />
              Nghĩ lâu nhất: {name(longest % 2 === 0 ? 'w' : 'b')}, nước {moveLabel(longest)} ({formatThink(times[longest] ?? 0)})
            </>
          )}
        </p>
      )}

      {sans.length > 0 && (
        <div className="result__actions">
          <button type="button" className="btn" onClick={onReview}>
            Xem lại từng nước
          </button>
          <a className="btn" href={analysisUrl(sans, orientation)} target="_blank" rel="noopener noreferrer">
            Phân tích trên lichess ↗
          </a>
        </div>
      )}
      {hint && <p className="result__hint">{hint}</p>}
    </div>
  )
}
