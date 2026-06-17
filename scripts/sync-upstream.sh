#!/usr/bin/env bash
#
# sync-upstream.sh — подтянуть свежий релиз оригинального cheating-daddy
# в этот форк, сохранив наши кастомные фичи (выбор экрана + хоткей скриншота).
#
# Использование:
#   ./scripts/sync-upstream.sh           # синхронизировать с upstream/master
#   ./scripts/sync-upstream.sh v0.8.0    # синхронизировать с конкретным тегом релиза
#
# Что делает:
#   1. Добавляет remote 'upstream' (если ещё нет)
#   2. Тянет свежие изменения из sohzm/cheating-daddy
#   3. Мержит их в твой master (наши коммиты-фичи остаются сверху)
#   4. Если есть конфликты — останавливается и показывает что чинить
#   5. После успеха предлагает пересобрать (npm install && npm run make)
#
set -euo pipefail

UPSTREAM_URL="https://github.com/sohzm/cheating-daddy.git"
TARGET="${1:-upstream/master}"

cd "$(dirname "$0")/.."

echo "==> Проверяю рабочее дерево…"
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "!! Есть незакоммиченные изменения. Закоммить или спрячь (git stash) и повтори."
    git status --short
    exit 1
fi

CURRENT_BRANCH="$(git symbolic-ref --short HEAD)"
if [ "$CURRENT_BRANCH" != "master" ]; then
    echo "==> Переключаюсь на master (был на '$CURRENT_BRANCH')"
    git checkout master
fi

echo "==> Настраиваю remote 'upstream'…"
if ! git remote get-url upstream >/dev/null 2>&1; then
    git remote add upstream "$UPSTREAM_URL"
fi

echo "==> Тяну свежак из upstream…"
git fetch upstream --tags --prune

# Если передан тег вида v0.8.0 — резолвим к нему
if [[ "$TARGET" == v* ]]; then
    TARGET_REF="$TARGET"
else
    TARGET_REF="upstream/master"
fi

BEHIND="$(git rev-list --count HEAD.."$TARGET_REF" 2>/dev/null || echo 0)"
if [ "$BEHIND" -eq 0 ]; then
    echo "==> Уже в актуальном состоянии с $TARGET_REF. Обновлять нечего. ✅"
    exit 0
fi

echo "==> Новых коммитов в upstream: $BEHIND"
echo "    Последние:"
git log --oneline HEAD.."$TARGET_REF" | head -15

echo "==> Сохраняю бэкап текущего master в ветку backup/pre-sync-$(date +%Y%m%d-%H%M%S)…"
git branch "backup/pre-sync-$(date +%Y%m%d-%H%M%S)" master

echo "==> Мержу $TARGET_REF в master…"
if git merge --no-edit "$TARGET_REF"; then
    echo ""
    echo "==> Синхронизация прошла чисто. ✅"
    echo "    Наши фичи (выбор экрана + хоткей скриншота) на месте."
    echo ""
    echo "Следующий шаг — пересобрать:"
    echo "    npm install && npm run make"
    echo "    git push origin master   # если хочешь сохранить на GitHub"
else
    echo ""
    echo "!! КОНФЛИКТ при мерже. Это нормально, если upstream трогал те же файлы что и наши фичи."
    echo "   Файлы наших фич: src/utils/window.js, src/utils/renderer.js,"
    echo "                    src/components/views/CustomizeView.js, src/index.js, src/storage.js"
    echo ""
    echo "   Конфликтные файлы:"
    git diff --name-only --diff-filter=U | sed 's/^/     /'
    echo ""
    echo "   Почини маркеры <<<<<<< / ======= / >>>>>>>, потом:"
    echo "     git add <файлы> && git commit --no-edit"
    echo "   Откатить всё назад:  git merge --abort"
    exit 2
fi
