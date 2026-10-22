// Đầu trang dùng chung cho mọi trang: tên web, nút chuyển giữa chơi chung một máy và chơi online,
// nút chọn bộ tiếng và nút loa. Lựa chọn âm thanh lưu trong máy, trang nào cũng dùng chung.
import { useEffect, useState } from 'react'
import { navigate } from '../router'
import { playSound, selectSoundSet, setSoundEnabled, setupSound, SOUND_SETS, type SoundSet } from '../sound'
import { loadSaved, save } from '../storage'
import { SoundSetPicker } from './SoundSetPicker'
import { SoundToggle } from './SoundToggle'

type Props = {
  switchTo: { path: string; label: string }
}

export function TopBar({ switchTo }: Props) {
  const [soundOn, setSoundOn] = useState<boolean>(() => loadSaved('sound', true))
  const [soundSet, setSoundSet] = useState<SoundSet>(() => {
    const saved = loadSaved<unknown>('soundSet', 'wood')
    return SOUND_SETS.find((set) => set === saved) ?? 'wood'
  })

  useEffect(() => save('sound', soundOn), [soundOn])
  useEffect(() => save('soundSet', soundSet), [soundSet])
  useEffect(() => setSoundEnabled(soundOn), [soundOn])
  useEffect(() => {
    selectSoundSet(soundSet)
  }, [soundSet])
  useEffect(() => setupSound(), [])

  // Bật tiếng thì kêu thử một tiếng để biết là đã có tiếng.
  function toggleSound() {
    const on = !soundOn
    setSoundOn(on)
    setSoundEnabled(on)
    if (on) playSound('move')
  }

  // Chọn bộ tiếng thì bật tiếng luôn (nếu đang tắt). Bảng chọn tự cho nghe thử bộ mới.
  function pickSoundSet(set: SoundSet) {
    setSoundSet(set)
    setSoundOn(true)
    setSoundEnabled(true)
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
      <div className="sound-controls">
        <SoundSetPicker value={soundSet} soundOn={soundOn} onChange={pickSoundSet} />
        <SoundToggle on={soundOn} onToggle={toggleSound} />
      </div>
    </header>
  )
}
