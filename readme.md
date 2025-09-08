# create-glsl-sandbox ✨

CLI для быстрого старта локальной песочницы шейдеров: **Three.js + Vite**.

---

## 🚀 Быстрый старт

Создать проект прямо из GitHub:

```bash
# pnpm
pnpm dlx github:alxmal/create-glsl-sandbox my-sandbox --run

# npx
npx --yes github:alxmal/create-glsl-sandbox my-sandbox --run
```

Параметры запуска:

-   `--pm pnpm|npm|yarn|bun` — выбрать пакетный менеджер
-   `--no-install` — не устанавливать зависимости
-   `--run` — сразу запустить dev-сервер

Зафиксировать версию (тег):

```bash
pnpm dlx github:alxmal/create-glsl-sandbox@v0.1.0 my-sandbox
```

---

## 🎯 Что генерируется

-   Vite-проект с Three.js
-   Полноэкранная плоскость 2×2 и `ShaderMaterial`
-   Юниформы:
    -   `u_time` — время в секундах
    -   `u_resolution` — `vec3(width, height, pixelAspect)`
-   Готовый фрагментный шейдер с примером анимированного градиента

Структура проекта:

```
index.html
package.json
vite.config.js
src/
  main.js           # Three.js приложение
  shaders/
    vert.glsl       # вершинный шейдер
    frag.glsl       # фрагментный шейдер
    lygia/          # LYGIA библиотека (git submodule)
```

Скрипты:

```bash
npm run dev       # локальный dev-сервер (Vite)
npm run build     # прод-сборка
npm run preview   # предпросмотр сборки
```

---

## 🧪 Работа с шейдерами

Редактируйте `src/shaders/frag.glsl` для создания ваших эффектов.

Пример нормализации координат:

```glsl
vec2 st = fragCoord / u_resolution.xy; // [0,1]
st = ratio(st, u_resolution.xy);       // исправление пропорций
vec2 uv = st * 2.0 - 1.0;              // [-1,1]
```

Используйте LYGIA функции через `#include`:

```glsl
#include "lygia/space/ratio.glsl"
#include "lygia/color/palette.glsl"
```

---

## ⚙️ Опции CLI

-   `--pm pnpm|npm|yarn|bun` — выбрать пакетный менеджер
-   `--no-install` — пропустить установку зависимостей
-   `--no-git` — пропустить git init
-   `--no-lygia` — не добавлять LYGIA submodule
-   `--no-code` — не открывать редактор (Cursor/VS Code)
-   `--editor cursor|vscode|auto` — выбрать предпочитаемый редактор
-   `--run` — запустить `dev` сразу после генерации

---

## 🛠 Локальная разработка CLI (опционально)

```bash
git clone git@github.com:alxmal/create-glsl-sandbox.git
cd create-glsl-sandbox
npm i
npm link
create-glsl-sandbox my-sandbox --run
```

---

## 🧯 Частые проблемы

-   Пустой экран — проверьте, что в `main()` присваивается `gl_FragColor`, а `u_resolution` ненулевая.
-   Пересвет/клиппинг — примените тонмап `tanh` и гамму `pow(col, 1.0/2.2)`.
-   Медленно — уменьшите количество итераций, частоты шума, уберите ветвления.
-   LYGIA не работает — убедитесь, что git submodule инициализирован: `git submodule update --init --recursive`

---

## 📄 Лицензия

MIT
