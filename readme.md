create-glsl-sandbox ✨

CLI для быстрого старта локальной песочницы шейдеров: Three.js + Vite. Совместимо со стилем Shadertoy (mainImage, fragCoord, iTime, iResolution).

⸻

🚀 Быстрый старт

Создать проект прямо из GitHub:
• pnpm: pnpm dlx github:alxmal/create-glsl-sandbox my-sandbox --run
• npx: npx --yes github:alxmal/create-glsl-sandbox my-sandbox --run

Параметры запуска:
• --pm pnpm|npm|yarn|bun — выбрать пакетный менеджер
• --no-install — не устанавливать зависимости
• --run — сразу запустить dev-сервер

Зафиксировать версию (по тегу): pnpm dlx github:alxmal/create-glsl-sandbox@v0.1.0 my-sandbox

⸻

🎯 Что генерируется
• Vite-проект с Three.js
• Полноэкранная плоскость 2×2 и ShaderMaterial
• Юниформы:
• iTime — время в секундах
• iResolution — vec3(width, height, pixelAspect)
• Обёртка для Shadertoy-стиля — вставляете тело mainImage(...), main() уже готов

Структура проекта:
• index.html
• package.json
• vite.config.js
• src/main.js — ваш фрагментный шейдер (функция mainImage)

Скрипты:
• npm run dev — локальный dev-сервер (Vite)
• npm run build — прод-сборка
• npm run preview — предпросмотр сборки

⸻

🧪 Перенос шейдера из Shadertoy

В файле src/main.js найдите фрагментный шейдер и вставьте ваш код внутрь mainImage(out vec4 fragColor, in vec2 fragCoord).
Подсказка по нормализации координат: vec2 uv = (fragCoord - 0.5\*iResolution.xy) / iResolution.y;
Функцию main() менять не нужно — она уже вызывает mainImage.

⸻

⚙️ Опции CLI
• --template three|raw — выбрать шаблон (по умолчанию three)
• --pm ... — пакетный менеджер
• --no-install — пропустить установку зависимостей
• --run — запустить dev сразу после генерации

⸻

🛠 Локальная разработка CLI (опционально)
• Клонирование: git clone git@github.com:alxmal/create-glsl-sandbox.git
• Установка: cd create-glsl-sandbox && npm i && npm link
• Создание проекта: create-glsl-sandbox my-sandbox --run

⸻

🧯 Частые проблемы
• Пустой экран — проверьте, что в mainImage присваивается fragColor, а iResolution ненулевая.
• Пересвет/клиппинг — примените тонмап tanh и гамму pow(col, 1.0/2.2).
• Медленно — уменьшите количество итераций, частоты шума, избегайте лишних ветвлений.

⸻

📄 Лицензия

MIT
