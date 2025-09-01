#!/usr/bin/env node
/** create-glsl-sandbox — CLI scaffold for a Three.js + Vite shader sandbox */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import child_process from 'node:child_process';
import prompts from 'prompts';
import { cyan, green, yellow, gray, bold } from 'kolorist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- helpers ----------
const write = (dest, content) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
};
const runCmd = (cmd, args, cwd) =>
    child_process.spawnSync(cmd, args, { stdio: 'inherit', cwd });
const detectPM = () => {
    const ua = process.env.npm_config_user_agent || '';
    if (ua.startsWith('pnpm')) return 'pnpm';
    if (ua.startsWith('yarn')) return 'yarn';
    if (ua.startsWith('bun')) return 'bun';
    return 'npm';
};
const hasCmd = (cmd) => {
    try {
        return (
            child_process.spawnSync(cmd, ['--version'], { stdio: 'ignore' })
                .status === 0
        );
    } catch {
        return false;
    }
};
const tryGitInit = (root, msg = 'init') => {
    if (!hasCmd('git')) return;
    if (fs.existsSync(path.join(root, '.git'))) return;
    let r = child_process.spawnSync('git', ['init', '-b', 'main'], {
        cwd: root,
        stdio: 'ignore',
    });
    if (r.status !== 0) {
        child_process.spawnSync('git', ['init'], {
            cwd: root,
            stdio: 'ignore',
        });
        child_process.spawnSync('git', ['branch', '-M', 'main'], {
            cwd: root,
            stdio: 'ignore',
        });
    }
    child_process.spawnSync('git', ['add', '-A'], {
        cwd: root,
        stdio: 'ignore',
    });
    child_process.spawnSync('git', ['commit', '-m', msg], {
        cwd: root,
        stdio: 'ignore',
    });
};

// ---------- project templates ----------
const projectPkg = (name) => ({
    name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { three: '^0.160.0' },
    devDependencies: { vite: '^5.4.0' },
});
const viteConfig = () =>
    `import { defineConfig } from 'vite';\nexport default defineConfig({ server: { open: true } });\n`;
const indexHtml = (title) =>
    `<!doctype html>\n<html lang="ru"><head>\n<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>\n<title>${title}</title>\n<style>html,body{height:100%;margin:0;background:#000;overflow:hidden}canvas{display:block}</style>\n</head><body><script type="module" src="/src/main.js"></script></body></html>`;

const mainJs = () =>
    `import * as THREE from 'three';\n\nconst renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });\ndocument.body.appendChild(renderer.domElement);\nconst scene = new THREE.Scene();\nconst camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);\n\nconst uniforms = { u_time:{value:0.0}, u_resolution:{value:new THREE.Vector3(1,1,1)} };\n\nconst vert = String.raw\`\nprecision highp float;\nattribute vec3 position;\nattribute vec2 uv;\nvarying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position, 1.0); }\n\`;\n\nconst frag = String.raw\`\nprecision highp float;\nuniform vec3  u_resolution; // (width, height, pixelAspect)\nuniform float u_time;\nvarying vec2  vUv;\n\nvoid main(){\n  vec2 fragCoord = vUv * u_resolution.xy;\n  vec2 uv = (fragCoord - 0.5*u_resolution.xy) / u_resolution.y;\n  float t = u_time;\n  vec3 col = 0.5 + 0.5*cos(6.28318*(uv.xyx + vec3(0.0,0.33,0.67)) + t);\n  gl_FragColor = vec4(col, 1.0);\n}\n\`;\n\nconst material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });\nconst quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);\nscene.add(quad);\n\nconst dpr = Math.min(window.devicePixelRatio || 1, 2);\nfunction resize(){\n  const w = window.innerWidth, h = window.innerHeight;\n  renderer.setPixelRatio(dpr);\n  renderer.setSize(w, h, false);\n  uniforms.u_resolution.value.set(w*dpr, h*dpr, 1.0);\n}\nwindow.addEventListener('resize', resize);\nresize();\n\nconst clock = new THREE.Clock();\nfunction tick(){\n  uniforms.u_time.value = clock.getElapsedTime();\n  renderer.render(scene, camera);\n  requestAnimationFrame(tick);\n}\ntick();\n`;

const readme = (name) =>
    `# ${name}\n\n**Commands**\n\n- \`npm run dev\` — start Vite dev server\n- \`npm run build\` — production build\n- \`npm run preview\` — preview build\n\nEdit \`src/main.js\`: put your fragment shader code in place.\n`;

// ---------- CLI ----------
async function run() {
    const argName = process.argv.find(
        (a) => !a.startsWith('-') && !a.endsWith('.js')
    );
    const args = Object.fromEntries(
        process.argv
            .filter((a) => a.startsWith('--'))
            .map((a) => a.replace(/^--/, ''))
            .map((kv) => {
                const [k, v] = kv.split('=');
                return [k, v ?? true];
            })
    );

    const answers = await prompts(
        [
            {
                name: 'projectName',
                type: argName ? null : 'text',
                message: 'Project name',
                initial: 'glsl-sandbox',
            },
            {
                name: 'template',
                type: args.template ? null : 'select',
                message: 'Template',
                choices: [
                    {
                        title: 'Three.js + Vite (Shadertoy-style)',
                        value: 'three',
                    },
                    { title: 'Raw WebGL + Vite (minimal)', value: 'raw' },
                ],
                initial: 0,
            },
            {
                name: 'pm',
                type: args.pm ? null : 'select',
                message: 'Package manager',
                choices: [
                    { title: 'npm', value: 'npm' },
                    { title: 'pnpm', value: 'pnpm' },
                    { title: 'yarn', value: 'yarn' },
                    { title: 'bun', value: 'bun' },
                ],
                initial: 0,
            },
        ],
        {
            onCancel: () => {
                console.log(gray('Cancelled.'));
                process.exit(1);
            },
        }
    );

    const projectName = (
        argName ||
        answers.projectName ||
        'glsl-sandbox'
    ).trim();
    const template = args.template || answers.template || 'three';
    const pm = args.pm || answers.pm || detectPM();

    const root = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(root) && fs.readdirSync(root).length) {
        console.log(yellow(`Directory ${projectName} is not empty.`));
        process.exit(1);
    }
    fs.mkdirSync(root, { recursive: true });

    // write files
    write(
        path.join(root, 'package.json'),
        JSON.stringify(projectPkg(projectName), null, 2) + '\n'
    );
    write(path.join(root, 'vite.config.js'), viteConfig());
    write(path.join(root, 'index.html'), indexHtml(projectName));
    write(path.join(root, 'src/main.js'), mainJs());
    write(
        path.join(root, '.gitignore'),
        ['node_modules', 'dist', '.DS_Store'].join('\n')
    );
    write(path.join(root, 'README.md'), readme(projectName));

    const autoInstall = !(args['no-install'] || args.noInstall);
    const autoGit = !(args['no-git'] || args.noGit);

    console.log(`\n${bold(cyan('Scaffolded'))} ${projectName} in ${root}`);
    if (autoInstall) {
        console.log(`\nInstalling dependencies with ${pm}...`);
        runCmd(pm, ['install'], root);
    } else {
        console.log(`\nNext steps:`);
        console.log(`  ${green('cd')} ${projectName}`);
        console.log(`  ${green(pm)} install`);
    }

    if (autoGit) {
        tryGitInit(root, 'init');
    }

    console.log(`  ${green(pm)} run dev`);
    console.log(`\nEdit ${cyan('src/main.js')} and the fragment shader.`);

    if (args.run) {
        const runArgs = pm === 'yarn' ? ['dev'] : ['run', 'dev'];
        runCmd(pm, runArgs, root);
    }
}

if (import.meta.url === `file://${__filename}`) run();
