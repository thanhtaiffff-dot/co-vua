// Mở form góp ý từ bất cứ nút nào trên trang (nút ở đầu trang, nút cuối trang trên điện thoại). Form chỉ có một,
// nằm trong đầu trang; các nút chỉ báo cho nó mở ra.
const openers = new Set<() => void>()

export function openFeedback(): void {
  for (const open of openers) open()
}

export function onOpenFeedback(open: () => void): () => void {
  openers.add(open)
  return () => openers.delete(open)
}
