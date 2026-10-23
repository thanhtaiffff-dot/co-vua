// Nút chọn bộ tiếng (hình nốt nhạc, cạnh nút loa) và bảng chọn mở ra khi bấm: điện thoại thì trượt lên từ cạnh
// dưới, máy tính thì hiện giữa màn hình. Chạm một bộ là nghe thử một đoạn ngắn và dùng luôn bộ đó, giống chọn
// nhạc chuông trên điện thoại. Dòng đầu "Theo chủ đề" cho tiếng tự đổi theo bộ quân đang dùng.
// Hàng nút cuối bảng cho nghe riêng từng tiếng của bộ đang kêu.
import { useEffect, useRef, useState } from 'react'
import { playSample, stopSample, type Sample, type SoundSet } from '../sound'
import { SET_SAMPLE, SOUND_EVENTS, SOUND_GROUPS, soundSetName } from '../soundCatalog'

// "theme": tiếng cùng chất liệu với bộ quân đang dùng. "fixed": giữ bộ tiếng đã chọn, đổi quân không đụng tới.
export type SoundMode = 'theme' | 'fixed'

type Props = {
  value: SoundSet // bộ đang kêu
  mode: SoundMode
  themeSet: SoundSet // bộ tiếng của bộ quân đang dùng
  themeName: string // tên bộ quân đang dùng
  soundOn: boolean
  onChange: (set: SoundSet) => void
  onFollowTheme: () => void
}

export function SoundSetPicker({ value, mode, themeSet, themeName, soundOn, onChange, onFollowTheme }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)
  // Đoạn đang kêu ("set:<bộ>" hoặc "event:<tiếng>"), để hiện hình sóng nhạc đúng chỗ.
  const [playing, setPlaying] = useState<string | null>(null)
  const turn = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressedBackdrop = useRef(false)
  const name = soundSetName(value)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      stopSample()
    },
    [],
  )

  async function listen(key: string, set: SoundSet, sample: Sample) {
    const mine = ++turn.current
    clearTimeout(timer.current)
    setPlaying(key)
    const seconds = await playSample(set, sample)
    if (mine !== turn.current) return
    if (seconds > 0) timer.current = setTimeout(() => setPlaying(null), seconds * 1000)
    else setPlaying(null)
  }

  function silence() {
    turn.current++
    clearTimeout(timer.current)
    stopSample()
    setPlaying(null)
  }

  function choose(set: SoundSet) {
    onChange(set)
    listen(`set:${set}`, set, SET_SAMPLE)
  }

  function follow() {
    onFollowTheme()
    listen('set:theme', themeSet, SET_SAMPLE)
  }

  // Mở bảng, cuộn tới bộ đang dùng cho nằm giữa danh sách, rồi đặt con trỏ bàn phím lên đó.
  function open() {
    const box = dialog.current
    if (!box || box.open) return
    box.showModal()
    const item = list.current?.querySelector<HTMLElement>('.sound-item--on')
    if (list.current && item) {
      list.current.scrollTop = item.offsetTop - (list.current.clientHeight - item.offsetHeight) / 2
      item.querySelector('input')?.focus({ preventScroll: true })
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn sound-set"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`Bộ tiếng: ${name}${mode === 'theme' ? ' (theo chủ đề)' : ''}. Bấm để đổi`}
        title={`Bộ tiếng: ${name}${mode === 'theme' ? ' (theo chủ đề)' : ''}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 17.4V7.6l11-2.6v10.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9.2 8.4 11-2.6" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <ellipse cx="6.9" cy="17.5" rx="2.6" ry="2.05" transform="rotate(-20 6.9 17.5)" fill="currentColor" />
          <ellipse cx="17.9" cy="15.3" rx="2.6" ry="2.05" transform="rotate(-20 17.9 15.3)" fill="currentColor" />
        </svg>
        <span className="sound-set__name">{name}</span>
      </button>

      {/* Chạm ra vùng tối bên ngoài bảng cũng là đóng. */}
      <dialog
        ref={dialog}
        className="sound-sheet"
        aria-labelledby="sound-sheet-title"
        onClose={silence}
        onPointerDown={(e) => {
          pressedBackdrop.current = e.target === e.currentTarget
        }}
        onClick={(e) => {
          if (pressedBackdrop.current && e.target === e.currentTarget) dialog.current?.close()
        }}
      >
        <header className="sound-sheet__head">
          <div className="sound-sheet__heading">
            <h2 className="sound-sheet__title" id="sound-sheet-title">
              Bộ tiếng
            </h2>
            <p className="sound-sheet__hint">
              {soundOn
                ? 'Chạm một bộ để nghe thử và dùng luôn.'
                : 'Đang tắt tiếng. Chạm một bộ để nghe thử, tiếng sẽ bật lại.'}
            </p>
          </div>
          <button type="button" className="sound-sheet__close" onClick={() => dialog.current?.close()} aria-label="Đóng">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="sound-sheet__list" ref={list}>
          <div className="sound-group" role="group" aria-labelledby="sound-group-auto">
            <span className="sound-group__name" id="sound-group-auto">
              Tự đổi
            </span>
            <SoundItem
              value="theme"
              name="Theo chủ đề"
              about={`Tiếng cùng chất liệu với bộ quân đang dùng. Quân ${themeName}: tiếng ${soundSetName(themeSet)}.`}
              swatch={themeSet}
              on={mode === 'theme'}
              sounding={playing === 'set:theme'}
              onPick={follow}
              onReplay={() => listen('set:theme', themeSet, SET_SAMPLE)}
            />
          </div>
          {SOUND_GROUPS.map((group, index) => (
            <div key={group.name} className="sound-group" role="group" aria-labelledby={`sound-group-${index}`}>
              <span className="sound-group__name" id={`sound-group-${index}`}>
                {group.name}
              </span>
              {group.sets.map((info) => (
                <SoundItem
                  key={info.id}
                  value={info.id}
                  name={info.name}
                  about={info.about}
                  swatch={info.id}
                  on={mode === 'fixed' && info.id === value}
                  sounding={playing === `set:${info.id}`}
                  onPick={() => choose(info.id)}
                  onReplay={() => listen(`set:${info.id}`, info.id, SET_SAMPLE)}
                />
              ))}
            </div>
          ))}
        </div>

        <footer className="sound-sheet__foot">
          <p className="sound-sheet__foot-title" id="sound-events-title">
            Nghe riêng từng tiếng của bộ <b>{name}</b>
          </p>
          <div className="sound-events" role="group" aria-labelledby="sound-events-title">
            {SOUND_EVENTS.map((event) => {
              const key = `event:${event.name}`
              return (
                <button
                  key={event.name}
                  type="button"
                  className={`sound-event${playing === key ? ' sound-event--on' : ''}`}
                  onClick={() => listen(key, value, event.sample)}
                >
                  {event.name}
                </button>
              )
            })}
          </div>
        </footer>
      </dialog>
    </>
  )
}

type ItemProps = {
  value: string
  name: string
  about: string
  swatch: SoundSet
  on: boolean
  sounding: boolean
  onPick: () => void
  onReplay: () => void
}

// Một dòng trong bảng: ô chọn tròn (ẩn), ô màu chất liệu, tên, lời tả, và dấu tích (hay sóng nhạc khi đang kêu).
function SoundItem({ value, name, about, swatch, on, sounding, onPick, onReplay }: ItemProps) {
  return (
    <label className={`sound-item${on ? ' sound-item--on' : ''}`}>
      <input
        type="radio"
        name="sound-set"
        value={value}
        checked={on}
        onChange={onPick}
        // Chạm lại bộ đang dùng thì nghe lại (ô đã chọn rồi nên không có sự kiện đổi).
        onClick={() => {
          if (on) onReplay()
        }}
      />
      <span className={`swatch swatch--${swatch}`} aria-hidden="true" />
      <span className="sound-item__text">
        <span className="sound-item__name">{name}</span>
        <span className="sound-item__about">{about}</span>
      </span>
      <span className="sound-item__mark" aria-hidden="true">
        {sounding ? (
          <span className="sound-wave">
            <span />
            <span />
            <span />
          </span>
        ) : (
          on && (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" fill="currentColor" />
              <path className="sound-item__tick" d="m7.2 12.4 3.2 3.2 6.4-6.6" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        )}
      </span>
    </label>
  )
}
