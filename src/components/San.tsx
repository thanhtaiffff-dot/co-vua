// Nước đi viết kiểu ký hiệu cờ, chữ chỉ quân (N, B, R, Q, K, cả quân phong cấp sau dấu "=") vẽ thành hình quân nhỏ
// như chess.com, lichess: "Nf3" hiện là hình con mã + f3. Chữ gốc vẫn nằm trong trang (đẩy ra khỏi khung hình) nên trình
// đọc màn hình đọc và chép ra vẫn là "Nf3". Hình quân vẽ ở index.css (lớp fig).
const LEAD = /^[KQRBN]/
const PROMOTION = /=([QRBN])/

function Fig({ letter }: { letter: string }) {
  return <span className={`fig fig--${letter.toLowerCase()}`}>{letter}</span>
}

export function San({ san }: { san: string }) {
  const lead = LEAD.test(san) ? san[0] : null
  const body = lead ? san.slice(1) : san
  const promo = PROMOTION.exec(body)
  return (
    <>
      {lead && <Fig letter={lead} />}
      {promo ? (
        <>
          {body.slice(0, promo.index + 1)}
          <Fig letter={promo[1]} />
          {body.slice(promo.index + 2)}
        </>
      ) : (
        body
      )}
    </>
  )
}
