CLI для быстрого старта локальной песочницы шейдеров: Three.js + Vite, совместимо со стилем Shadertoy (mainImage, fragCoord, iTime, iResolution).

Быстрый старт

Создать проект прямо из GitHub:

pnpm: pnpm dlx github:alxmal/create-glsl-sandbox my-sandbox --run
npx: npx --yes github:alxmal/create-glsl-sandbox my-sandbox --run

Параметры запуска:
• --pm pnpm|npm|yarn|bun — выбрать пакетный менеджер
• --no-install — не устанавливать зависимости
• --run — сразу запустить dev-сервер

Зафиксировать версию (по тегу): pnpm dlx github:alxmal/create-glsl-sandbox@v0.1.0 my-sandbox

Что генерируется
• Vite-проект с Three.js
• Полноэкранная плоскость 2×2 и ShaderMaterial
• Юниформы:
• iTime — время в секундах
• iResolution — vec3(width, height, pixelAspect)
• Обёртка для кода в стиле Shadertoy — вставляете тело mainImage(...) без изменения main()

Структура:
• index.html
• package.json
• vite.config.js
• src/main.js — ваш фрагментный шейдер (mainImage)

Скрипты:
• npm run dev — старт dev-сервера (Vite)
• npm run build — прод-сборка
• npm run preview — предпросмотр сборки

Как перенести шейдер с Shadertoy

В src/main.js найдите фрагментный шейдер и вставьте ваш код внутрь функции mainImage(out vec4 fragColor, in vec2 fragCoord). Нормализация координат пример: vec2 uv = (fragCoord - 0.5\*iResolution.xy) / iResolution.y;. Функция main() уже настроена и вызывает mainImage, вам её трогать не нужно.

Опции CLI

Интерактивный режим по умолчанию. Флаги:
• --template three|raw — шаблон (по умолчанию three)
• --pm ... — выбрать пакетный менеджер
• --no-install — пропустить установку
• --run — сразу запустить dev после генерации

Локальная разработка CLI

Клонирование: git clone git@github.com:alxmal/create-glsl-sandbox.git
Установка: cd create-glsl-sandbox && npm i && npm link
Создание проекта: create-glsl-sandbox my-sandbox --run

Частые проблемы
• Пустой экран — проверьте, что в mainImage присваивается fragColor, а iResolution не нулевая.
• Пересвет/клиппинг — добавьте тонмап tanh и гамму pow(col, 1.0/2.2).
• Низкая скорость — уменьшите число итераций, частоты шума, уберите ветвления.

Лицензия

MIT
