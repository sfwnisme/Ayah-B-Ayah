# Chrome Web Store — ready-to-paste listing content

Everything the Developer Dashboard asks for, in submission order. Primary language: **العربية (Arabic)**. Suggested category: **Education / تعليم**.

---

## Store listing tab

### Title (from manifest)

قرآن — آية بآية

### Short description (≤132 chars)

اقرأ القرآن الكريم آيةً آية من متصفحك، مع حفظ آخر موضع قراءة تلقائيًا. بحث بالسورة والآية، خفيف ويعمل دون اتصال.

### Detailed description — العربية

اقرأ القرآن الكريم آيةً آية مباشرة من شريط أدوات المتصفح، في أي وقت يتوفر لديك فيه دقائق للقراءة.

المزايا:
◈ عرض آية واحدة في كل مرة بخط الملك فهد «عثمان طه» النسخي، مع رقم الآية واسم السورة ورقم الجزء.
◈ تنقّل بين الآيات بزرّي «التالية» و«السابقة»، مع الانتقال التلقائي بين السور.
◈ حفظ تلقائي لآخر موضع قراءة — أغلق المتصفح وعُد لتجد نفسك حيث توقفت.
◈ اختيار أي سورة بالبحث بالاسم أو الرقم، واختيار أي آية بالبحث بنصها أو رقمها.
◈ البحث يقبل الكتابة العادية دون تشكيل (اكتب «الرحمن» لتجد «ٱلرَّحْمَٰنِ»).
◈ زرّا «أ+» و«أ−» لتكبير حجم خط الآية وتصغيره مع عرض القيمة الحالية، وحفظ اختيارك.
◈ مفتاح المسافة لمتابعة القراءة: يمرّر الآية الطويلة ثم ينتقل إلى التالية، وزر «؟» يعرض كل الاختصارات.
◈ واجهة عربية بالكامل من اليمين إلى اليسار بألوان هادئة مريحة للعين.
◈ خفيف جدًا ويعمل دون اتصال بالإنترنت — النص الكامل للقرآن الكريم (٦٢٣٦ آية) مضمّن داخل الملحق.
◈ خصوصية تامة: لا يجمع أي بيانات ولا يتصل بأي خادم إطلاقًا.

شكر وتقدير:
خط المصحف: خط الملك فهد «عثمان طه» النسخي، إصدار مجمع الملك فهد لطباعة المصحف الشريف — https://fonts.qurancomplex.gov.sa/nashkh-font/

### Detailed description — English (add as translation)

Read the Holy Quran one ayah (verse) at a time, right from your browser toolbar, whenever you have a few free minutes.

Features:
◈ One ayah per view in the beautiful KFGQPC Uthman Taha Naskh typeface, with the ayah number, surah name, and juz number.
◈ Next/previous navigation with automatic transition across surah boundaries.
◈ Your last-read position is saved automatically — close the browser and pick up exactly where you stopped.
◈ Jump to any surah by name or number, and to any ayah by its text or number.
◈ Search works with plain, unvocalized Arabic (type "الرحمن" to find "ٱلرَّحْمَٰنِ").
◈ Adjustable ayah text size with the أ+ / أ− buttons, current value always visible — your choice is remembered.
◈ Space is the “read on” key: it pages through a long ayah, then moves to the next one — and a ? button lists every shortcut.
◈ Fully right-to-left Arabic interface with calm, eye-comfortable colors.
◈ Extremely lightweight and fully offline — the complete Quran text (6,236 ayahs) is bundled inside the extension.
◈ Total privacy: collects no data and never contacts any server.

Credits:
Quranic typeface: KFGQPC Uthman Taha Naskh, published by the King Fahd Glorious Quran Printing Complex — https://fonts.qurancomplex.gov.sa/nashkh-font/

### Screenshots

Upload all five 1280×800 PNGs from `store/screenshots/`, in this order — each one
covers a different part of the extension:

1. `screenshot-1-reading.png` — the reading view (النجم ٢٩)
2. `screenshot-2-picker.png` — surah/ayah picker with tashkeel-free search
3. `screenshot-3-font-size.png` — the font-size stepper at a large size
4. `screenshot-4-shortcuts.png` — the keyboard-shortcuts dialog
5. `screenshot-5-offline.png` — offline / privacy pitch

Regenerate them with `node scripts/make-screenshots.mjs` after any UI change.

---

## Privacy tab

### Single purpose description

This extension has a single purpose: reading the Quran one verse at a time inside the browser action popup, with next/previous navigation, surah/verse search, and reading aids for that text (adjustable font size and keyboard shortcuts). It does not read or modify web pages and has no other functionality.

### Permission justification — `storage`

Used exclusively to save two local preferences on the device via chrome.storage.local: the user's last-read position (surah and ayah number), so reading resumes where it stopped, and the chosen ayah font size. No other data is stored and nothing is transmitted anywhere.

### Remote code

No, I am not using remote code. (All JavaScript, the Quran text data, and the font are packaged inside the extension; there are no runtime network requests.)

### Data usage

Check: **"This item does not collect or use user data"** — nothing is collected, sold, or transferred. The certification checkboxes (no sale of data, no unrelated use, no creditworthiness use) can all be checked truthfully.

### Privacy policy URL (optional field)

Not required since no data is collected. If you want to provide one anyway, host `store/PRIVACY.md` (e.g. in the GitHub repo) and paste its URL.

---

## Submission checklist (human steps)

1. Developer account at https://chrome.google.com/webstore/devconsole — one-time $5 registration fee, verified email, 2FA enabled.
2. Run `node scripts/package.mjs` and upload `dist/one-quran-v1.0.0.zip` ("New item").
3. Paste the texts above into the Store listing and Privacy tabs; pick category **Education**, language **العربية**.
4. Upload the screenshots from `store/screenshots/`.
5. Visibility: Public (or Unlisted for a soft launch) → Submit for review.

Expected review outcome: this package qualifies for the lightest review path — Manifest V3, a single `storage` permission, no host permissions, no content scripts, no remote code.
