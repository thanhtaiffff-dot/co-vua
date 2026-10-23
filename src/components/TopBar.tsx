// Đầu trang dùng chung cho mọi trang: tên web, nút chuyển giữa chơi chung một máy và chơi online, nút chọn chủ đề,
// nút chọn bộ tiếng và nút loa. Lựa chọn chủ đề và âm thanh lưu trong máy, trang nào cũng dùng chung.
import { useEffect, useState } from 'react'
import { navigate } from '../router'
import { playSample, playSound, selectSoundSet, setSoundEnabled, setupSound, SOUND_SETS, type SoundSet } from '../sound'
import { loadSaved, save } from '../storage'
import { useTheme } from '../theme'
import { pieceSetInfo, type PieceSetId } from '../themeCatalog'
import { SoundSetPicker, type SoundMode } from './SoundSetPicker'
import { SoundToggle } from './SoundToggle'
import { ThemePicker } from './ThemePicker'

type Props = {
  switchTo: { path: string; label: string }
}

// Máy đã chọn sẵn một bộ tiếng khác Gỗ (từ trước khi có chủ đề) thì giữ bộ đó; còn lại tiếng theo chủ đề.
function savedSoundMode(): SoundMode {
  const saved = loadSaved<unknown>('soundMode', null)
  if (saved === 'theme' || saved === 'fixed') return saved
  return loadSaved<unknown>('soundSet', 'wood') === 'wood' ? 'theme' : 'fixed'
}

export function TopBar({ switchTo }: Props) {
  const theme = useTheme()
  const [soundOn, setSoundOn] = useState<boolean>(() => loadSaved('sound', true))
  const [soundMode, setSoundMode] = useState<SoundMode>(savedSoundMode)
  // Bộ tiếng chọn riêng (dùng khi tiếng không theo chủ đề).
  const [soundSet, setSoundSet] = useState<SoundSet>(() => {
    const saved = loadSaved<unknown>('soundSet', 'wood')
    return SOUND_SETS.find((set) => set === saved) ?? 'wood'
  })
  const themeSound = pieceSetInfo(theme.pieces).sound
  const activeSet = soundMode === 'theme' ? themeSound : soundSet

  useEffect(() => save('sound', soundOn), [soundOn])
  useEffect(() => save('soundMode', soundMode), [soundMode])
  useEffect(() => save('soundSet', soundSet), [soundSet])
  useEffect(() => setSoundEnabled(soundOn), [soundOn])
  useEffect(() => {
    selectSoundSet(activeSet)
  }, [activeSet])
  useEffect(() => setupSound(), [])

  // Bật tiếng thì kêu thử một tiếng để biết là đã có tiếng.
  function toggleSound() {
    const on = !soundOn
    setSoundOn(on)
    setSoundEnabled(on)
    if (on) playSound('move')
  }

  // Chọn bộ tiếng (hay chọn "Theo chủ đề") thì bật tiếng luôn (nếu đang tắt). Bảng chọn tự cho nghe thử bộ mới.
  function pickSoundSet(set: SoundSet) {
    setSoundMode('fixed')
    setSoundSet(set)
    setSoundOn(true)
    setSoundEnabled(true)
  }

  function followTheme() {
    setSoundMode('theme')
    setSoundOn(true)
    setSoundEnabled(true)
  }

  // Đổi bộ quân khi tiếng đang theo chủ đề: cho nghe tiếng đi quân của bộ mới.
  function pickPieces(id: PieceSetId) {
    if (soundOn && soundMode === 'theme') playSample(pieceSetInfo(id).sound, [['move', 0]])
  }

  return (
    <header className="topbar">
      <h1 className="brand">Cờ vua</h1>
      <a
        className="mode-link"
        href={switchTo.path}
        onClick={(e) => {
          e.preventDefault()
          navigate(switchTo.path)
        }}
      >
        {switchTo.label}
      </a>
      <div className="topbar__tools">
        <ThemePicker onPickPieces={pickPieces} />
        <SoundSetPicker
          value={activeSet}
          mode={soundMode}
          themeSet={themeSound}
          themeName={pieceSetInfo(theme.pieces).name}
          soundOn={soundOn}
          onChange={pickSoundSet}
          onFollowTheme={followTheme}
        />
        <SoundToggle on={soundOn} onToggle={toggleSound} />
      </div>
    </header>
  )
}
