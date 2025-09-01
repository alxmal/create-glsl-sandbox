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

const tryOpenVSCode = (root) => {
    if (!hasCmd('code')) return false;
    const r = child_process.spawnSync('code', ['.'], {
        cwd: root,
        stdio: 'ignore',
    });
    return r.status === 0;
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
    devDependencies: { vite: '^5.4.0', 'vite-plugin-glsl': '^1.3.0' },
});

const viteConfig = () => `import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl({ include: ['**/*.glsl','**/*.vert','**/*.frag'] })],
  server: { open: true },
});
`;

const indexHtml = (title) => `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>html,body{height:100%;margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
</head><body><script type="module" src="/src/main.js"></script></body></html>`;

const mainJs = () => `import * as THREE from 'three';
import vert from './shaders/vert.glsl';
import frag from './shaders/frag.glsl';

const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

// u_* uniforms
const uniforms = {
  u_time: { value: 0.0 },
  u_resolution: { value: new THREE.Vector3(1,1,1) },
};

const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
scene.add(quad);

const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  uniforms.u_resolution.value.set(w*dpr, h*dpr, 1.0);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function tick(){
  uniforms.u_time.value = clock.getElapsedTime();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
`;

// default shader files
const shaderVert = () => `precision highp float;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const shaderFrag = () => `precision highp float;
uniform vec3  u_resolution;
uniform float u_time;
varying vec2  vUv;

void main(){
  vec2 fragCoord = vUv * u_resolution.xy;
  vec2 uv = (fragCoord - 0.5*u_resolution.xy) / u_resolution.y;
  float t = u_time;
  vec3 col = 0.5 + 0.5*cos(6.28318*(uv.xyx + vec3(0.0,0.33,0.67)) + t);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- CLI ----------
async function run() {
    const argv = process.argv.slice(2);
    const positionals = argv.filter((a) => !a.startsWith('-'));
    const argName = positionals[0];

    const args = Object.fromEntries(
        argv
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
                    { title: 'Three.js + Vite', value: 'three' },
                    { title: 'Raw WebGL + Vite', value: 'raw' },
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
    write(path.join(root, 'src/shaders/vert.glsl'), shaderVert());
    write(path.join(root, 'src/shaders/frag.glsl'), shaderFrag());
    write(
        path.join(root, '.gitignore'),
        ['node_modules', 'dist', '.DS_Store'].join('\n')
    );

    const autoInstall = !(args['no-install'] || args.noInstall);
    const autoGit = !(args['no-git'] || args.noGit);
    const autoCode = !!(args.code || args.openCode);

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
    if (autoCode) {
        const ok = tryOpenVSCode(root);
        if (!ok)
            console.log(
                gray(
                    "VS Code 'code' command not found. Install it via Command Palette."
                )
            );
    }

    console.log(`  ${green(pm)} run dev`);
    console.log(
        `\nEdit ${cyan('src/shaders/*.glsl')} and ${cyan('src/main.js')}.`
    );

    if (args.run) {
        const runArgs = pm === 'yarn' ? ['dev'] : ['run', 'dev'];
        runCmd(pm, runArgs, root);
    }
}

if (import.meta.url === `file://${__filename}`) run();
