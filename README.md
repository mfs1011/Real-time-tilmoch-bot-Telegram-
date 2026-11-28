# Real-time Tilmoch — Telegram tarjimon bot

O‘zbekcha yozib, istalgan chatda kerakli tilga tarjima qilib yuboradigan
shaxsiy Telegram bot. **Telegram Serverless** ustida ishlaydi — server kerak emas.

## Imkoniyatlar

- **Inline tarjima** — istalgan chatda `@bot en salom, qalaysan?`
  - til kodisiz yozilsa — sevimli tillardagi tarjimalar ro‘yxati, keragini tanlaysiz
  - yozish paytida maslahatlar (`@bot e` → 🇬🇧 en · 🇪🇸 es)
  - debounce: yozish tugagach so‘rov ketadi
- **83 ta tayyor til** + istalgan 2 harfli ISO kod, **dialektlar** (`/dialect`)
- **Maxsus komandalar**: `fix` (imloni tuzatish), `rasmiy` (rasmiy uslub)
- **Kelgan xabarlarni tushunish** — botga forward qiling: matn, 🎙 ovoz, 📹 dumaloq video, 🖼 rasm (STT/OCR + tarjima)
- **Ovozli xabar (TTS)** — `@bot say en salom`, `/say`, 🔊 tugmasi
  - 30 ta ovoz (`/voice`), 12 ta personaj (`/persona`, yoki `say qaroqchi en …`)
  - o‘zbekcha matn (300 belgigacha) — **Gapiring** ovozi, o‘z serverimizda (`tts.kamgapir.uz`), limitsiz
  - qolgani — Gemini TTS modellari navbat bilan, limit tugasa — bepul Google ovozi
  - ovozlar keshlanadi, har bir ovoz ostida model nomi
- **Emojilar o‘zgarmaydi** — tarjimada himoyalanadi
- **Ruxsatlar** — `/users`: so‘rovlar, ruxsat berish/olish, ochiq rejim

## Komandalar

| Komanda | Vazifa |
|---|---|
| `/help` | qo‘llanma |
| `/lang en` · `/fav en ru tr` · `/langs` | standart til, sevimli tillar, ro‘yxat |
| `/dialect en` | dialekt (American, British, …) |
| `/voice` · `/persona` | ovoz va personaj |
| `/uzovoz` | o‘zbekcha ovoz (Gapiring): ayol/erkak, ohang, uslub, jonlilik |
| `/say en matn` | tarjima qilib ovozli xabar |
| `/limits` | bugungi TTS limitlari |
| `/key <kalit>` · `/model` | (egasi) Gemini/Claude kaliti, model tanlash |
| `/ttskey <kalit>` | (egasi) o‘zbekcha ovoz serveri (gapir) kaliti; `/ttskey off` |
| `/users` · `/allow <id>` · `/deny <id>` | (egasi) foydalanuvchilar |

## Ishga tushirish

1. @BotFather: bot yarating, **Serverless**ni yoqing, `/setinline` bilan inline rejimni yoqing.
2. Loyiha:
   ```bash
   npm install
   npx tgcloud login     # BotFather → Serverless → CLI Access → Access token
   npx tgcloud push      # deploy
   npx tgcloud migrate   # bazani yaratish
   ```
3. Botga `/start` — birinchi yozgan odam egasi bo‘ladi.
4. Botga `/key <Gemini API kaliti>` (AI Studio). Kalitsiz Google Translate ishlaydi.

## Tuzilishi

```
tgcloud/
  handlers/   message · inline_query · callback_query
  lib/        tarjima, TTS/STT, tillar, dialektlar, ruxsatlar, kesh, debounce
  lib/vendor/lame.js   MP3 kodlovchi
  schema.js   baza jadvallari
```

Platforma qoidalari: [AGENTS.md](AGENTS.md) · SDK: [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md)

## Litsenziyalar

O‘zbekcha ovoz: Gapiring by Gapi (https://gapi.uz), an adaptation of Kyutai Pocket TTS
(https://huggingface.co/kyutai/pocket-tts), CC BY 4.0.


`tgcloud/lib/vendor/lame.js` — [lamejs](https://github.com/zhuker/lamejs) 1.2.1
(LGPL), [LAME](https://lame.sourceforge.net) asosida. Fayl o‘zgartirilmagan,
faqat oxiriga ESM eksport qo‘shilgan.
