# Кастомные фичи этого форка

Этот форк `sohzm/cheating-daddy` (GPL-3.0) добавляет две фичи поверх upstream.
Документирую, чтобы при синхронизации с оригиналом было ясно, что наше.

## 1. Выбор экрана для захвата (Capture Display)
Фикс хардкода `sources[0]` — на мультимониторных сетапах теперь можно выбрать,
какой монитор захватывать.

- **Settings → Capture Display** — dropdown со списком мониторов
  (Built-in/External + разрешение).
- Выбор хранится по **ID дисплея** (стабильно при переупорядочивании).
- Затронутые файлы: `src/utils/window.js`, `src/index.js` (`get-display-sources` IPC),
  `src/components/views/CustomizeView.js`, `src/storage.js` (`captureDisplayId`).
- Основано на неслитом upstream PR #279.

## 2. Хоткей ручного скриншота (Take Screenshot)
Отдельный настраиваемый хоткей (дефолт `Cmd/Ctrl+Shift+S`), снимает выбранный
экран по требованию. Триггерит ту же анимацию кнопки «Analyze Screen», что и клик —
визуальная обратная связь.

- Затронутые файлы: `src/utils/window.js` (регистрация шортката),
  `src/utils/renderer.js` (`handleShortcut('manual-screenshot')` → `handleScreenAnswer()`),
  `src/components/views/CustomizeView.js` (keybind в Settings).

## 3. Ad-hoc подпись сборки (macOS)
В `forge.config.js` включена ad-hoc подпись (`osxSign: { identity: '-' }`) +
`postPackage` hook, который той же ad-hoc идентичностью + entitlements подписывает
вложенный `SystemAudioDump`.

Зачем: `SystemAudioDump` использует ScreenCaptureKit (нужен Screen Recording
permission). Без согласованной подписи macOS заводил **отдельную** TCC-запись для
хелпера (дубль «Cheating Daddy.app» с иконкой-человечком) и сбрасывал permission
при каждой пересборке. Ad-hoc подпись даёт стабильную идентичность → дубли
перестают плодиться, permission держится между пересборками.

Apple Developer аккаунт не нужен. Gatekeeper при первом запуске всё ещё может
ругаться — снять карантин: `xattr -cr "/Applications/Cheating Daddy.app"`.

## Обновление из upstream
Когда выходит новая версия оригинала:

```bash
./scripts/sync-upstream.sh            # с upstream/master
./scripts/sync-upstream.sh v0.8.0     # с конкретного релиза
```

Скрипт мержит upstream, сохраняя наши коммиты-фичи, делает бэкап-ветку,
и при конфликте показывает что чинить. После успеха — `npm install && npm run make`.
