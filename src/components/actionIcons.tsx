// Hình vẽ cho các nút chỉ có hình (ActionButton, nút tự xoay bàn ở BoardTools). Để riêng một file vì không phải component.
import type { ReactNode } from 'react'

export const ACTION_ICONS = {
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 4.5h11.5l-2.6 4.3 2.6 4.3H5.5" />
    </>
  ),
  newGame: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  autoFlip: (
    <>
      <path d="M4.5 11a7.6 7.6 0 0 1 13.2-4.3L19.5 8.6" />
      <path d="M19.5 4.2v4.4h-4.4" />
      <path d="M19.5 13a7.6 7.6 0 0 1-13.2 4.3L4.5 15.4" />
      <path d="M4.5 19.8v-4.4h4.4" />
    </>
  ),
  chat: <path d="M4.5 5.5h15v10.2H9.4l-4.9 3.8z" />,
  chatOff: (
    <>
      <path d="M4.5 5.5h15v10.2H9.4l-4.9 3.8z" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
} satisfies Record<string, ReactNode>
