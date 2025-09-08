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
    try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, content);
    } catch (error) {
        console.error(`❌ Failed to write ${dest}:`, error.message);
        process.exit(1);
    }
};
const runCmd = (cmd, args, cwd, silent = false) => {
    const result = child_process.spawnSync(cmd, args, {
        stdio: silent ? 'pipe' : 'inherit',
        cwd,
    });
    if (result.status !== 0 && !silent) {
        console.error(`❌ Command failed: ${cmd} ${args.join(' ')}`);
        process.exit(1);
    }
    return result;
};
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
    if (!hasCmd('git')) {
        console.log(gray('Git not found, skipping git init'));
        return;
    }
    if (fs.existsSync(path.join(root, '.git'))) {
        console.log(gray('Git repository already exists'));
        return;
    }

    try {
        console.log('🔧 Initializing git repository...');
        let r = runCmd('git', ['init', '-b', 'main'], root, true);
        if (r.status !== 0) {
            runCmd('git', ['init'], root, true);
            runCmd('git', ['branch', '-M', 'main'], root, true);
        }
        runCmd('git', ['add', '-A'], root, true);
        runCmd('git', ['commit', '-m', msg], root, true);
        console.log(green('✅ Git repository initialized'));
    } catch (error) {
        console.log(yellow(`⚠️  Git init failed: ${error.message}`));
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

// Validation helpers
const validateProjectName = (name) => {
    if (!name || name.trim().length === 0) {
        throw new Error('Project name cannot be empty');
    }

    const trimmed = name.trim();

    // Check for invalid characters
    if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
        throw new Error(
            'Project name can only contain letters, numbers, hyphens and underscores'
        );
    }

    // Check for reserved names
    const reserved = [
        'node_modules',
        'dist',
        'build',
        'src',
        'public',
        'test',
        'tests',
    ];
    if (reserved.includes(trimmed.toLowerCase())) {
        throw new Error(
            `"${trimmed}" is a reserved name. Please choose a different name.`
        );
    }

    // Check length
    if (trimmed.length > 50) {
        throw new Error('Project name is too long (max 50 characters)');
    }

    return trimmed;
};

// NEW: add LYGIA as git submodule by default
const addLygiaSubmodule = (root) => {
    if (!hasCmd('git')) {
        console.log(gray('Git not found, skipping LYGIA submodule'));
        return;
    }

    const subPath = path.join(root, 'src/shaders/lygia');
    if (fs.existsSync(subPath)) {
        console.log(gray('LYGIA submodule already exists'));
        return;
    }

    try {
        console.log('📦 Adding LYGIA submodule...');
        const result = runCmd(
            'git',
            [
                'submodule',
                'add',
                'https://github.com/patriciogonzalezvivo/lygia.git',
                'src/shaders/lygia',
            ],
            root,
            true
        );

        if (result.status === 0) {
            // track main branch (optional)
            runCmd(
                'git',
                [
                    'submodule',
                    'set-branch',
                    '--branch',
                    'main',
                    'src/shaders/lygia',
                ],
                root,
                true
            );

            runCmd('git', ['add', '-A'], root, true);
            runCmd('git', ['commit', '-m', 'add lygia submodule'], root, true);
            console.log(green('✅ LYGIA submodule added successfully'));
        } else {
            throw new Error('Failed to add submodule');
        }
    } catch (error) {
        console.log(
            yellow(`⚠️  Failed to add LYGIA submodule: ${error.message}`)
        );
        console.log(gray('You can add it manually later with:'));
        console.log(
            gray(
                '  git submodule add https://github.com/patriciogonzalezvivo/lygia.git src/shaders/lygia'
            )
        );
    }
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

// NEW: set GLSL root to src/shaders so #include "lygia/..." works from submodule
const viteConfig = () => `import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [glsl({
    include: ['**/*.glsl','**/*.vert','**/*.frag','**/*.vs','**/*.fs','**/*.wgsl'],
    root: [ path.resolve(__dirname, 'src/shaders') ],
  })],
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

// NEW: default frag uses LYGIA include
const shaderFrag = () => `precision highp float;
uniform vec3  u_resolution;
uniform float u_time;
varying vec2  vUv;

#include "lygia/space/ratio.glsl"

void main(){
  vec2 fragCoord = vUv * u_resolution.xy;
  vec2 st = fragCoord / u_resolution.xy; // [0,1]
  st = ratio(st, u_resolution.xy);       // fix aspect
  vec2 uv = st * 2.0 - 1.0;              // [-1,1]

  float t = u_time;
  vec3 col = 0.5 + 0.5*cos(6.28318*(uv.xyx + vec3(0.0,0.33,0.67)) + t);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- CLI ----------
async function run() {
    const argv = process.argv.slice(2);

    // Show help if requested
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`
${bold(
    cyan('create-glsl-sandbox')
)} - CLI scaffold for Three.js + Vite shader sandbox

${bold('Usage:')}
  create-glsl-sandbox [project-name] [options]

${bold('Options:')}
  --pm <manager>     Package manager (npm|pnpm|yarn|bun)
  --no-install       Skip dependency installation
  --no-git           Skip git initialization
  --no-lygia         Skip LYGIA submodule addition
  --no-code          Skip VS Code opening
  --run              Start dev server after setup
  --help, -h         Show this help

${bold('Examples:')}
  create-glsl-sandbox my-shader
  create-glsl-sandbox my-shader --pm pnpm --run
  create-glsl-sandbox my-shader --no-git --no-lygia

${bold('Features:')}
  ✨ Three.js + Vite setup
  🎨 GLSL shader support with hot reload
  📦 LYGIA shader library integration
  🔧 VS Code auto-opening
  🚀 Ready-to-run development environment
`);
        process.exit(0);
    }

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

    // Show welcome message
    if (!argName) {
        console.log(
            `\n${bold(
                cyan('✨ create-glsl-sandbox')
            )} - Three.js + Vite shader sandbox`
        );
        console.log(gray('Create a new GLSL shader development environment\n'));
    }

    const answers = await prompts(
        [
            {
                name: 'projectName',
                type: argName ? null : 'text',
                message: 'Project name',
                initial: 'glsl-sandbox',
                validate: (value) => {
                    try {
                        validateProjectName(value);
                        return true;
                    } catch (error) {
                        return error.message;
                    }
                },
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
                console.log(gray('\n❌ Cancelled.'));
                process.exit(1);
            },
        }
    );

    let projectName;
    try {
        projectName = validateProjectName(
            argName || answers.projectName || 'glsl-sandbox'
        );
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }

    const pm = args.pm || answers.pm || detectPM();

    const root = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(root) && fs.readdirSync(root).length) {
        console.log(yellow(`❌ Directory "${projectName}" is not empty.`));
        console.log(
            gray(
                'Please choose a different name or remove the existing directory.'
            )
        );
        process.exit(1);
    }

    try {
        fs.mkdirSync(root, { recursive: true });
    } catch (error) {
        console.error(
            `❌ Failed to create directory "${projectName}":`,
            error.message
        );
        process.exit(1);
    }

    // write files
    console.log('📝 Creating project files...');
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
    console.log(green('✅ Project files created'));

    // defaults
    const autoInstall = !(args['no-install'] || args.noInstall);
    const autoGit = !(args['no-git'] || args.noGit);
    const autoCode = !(args['no-code'] || args.noCode); // open VS Code by default
    const autoRun =
        !!args.run || (autoInstall && !(args['no-run'] || args.noRun)); // run dev after install

    console.log(
        `\n${bold(cyan('✨ Scaffolded'))} ${bold(projectName)} in ${root}`
    );
    if (autoInstall) {
        console.log(`\n📦 Installing dependencies with ${pm}...`);
        try {
            runCmd(pm, ['install'], root);
            console.log(green('✅ Dependencies installed'));
        } catch (error) {
            console.log(yellow(`⚠️  Installation failed: ${error.message}`));
            console.log(gray('You can install manually later with:'));
            console.log(gray(`  cd ${projectName} && ${pm} install`));
        }
    } else {
        console.log(`\n📋 Next steps:`);
        console.log(`  ${green('cd')} ${projectName}`);
        console.log(`  ${green(pm)} install`);
    }

    if (autoGit) {
        tryGitInit(root, 'init');
    }

    // NEW: add LYGIA submodule unless disabled
    const withLygia = !(args['no-lygia'] || args.noLygia);
    if (autoGit && withLygia) {
        addLygiaSubmodule(root);
    }

    if (autoCode) {
        console.log('🔧 Opening VS Code...');
        const ok = tryOpenVSCode(root);
        if (ok) {
            console.log(green('✅ VS Code opened'));
        } else {
            console.log(
                gray(
                    "⚠️  VS Code 'code' command not found. Install it via Command Palette."
                )
            );
        }
    }

    console.log(`\n🚀 To start development:`);
    console.log(`  ${green(pm)} run dev`);
    console.log(
        `\n📝 Edit ${cyan('src/shaders/*.glsl')} and ${cyan(
            'src/main.js'
        )} to create your shaders.`
    );

    if (autoRun) {
        console.log('\n🏃 Starting development server...');
        const runArgs = pm === 'yarn' ? ['dev'] : ['run', 'dev'];
        try {
            runCmd(pm, runArgs, root);
        } catch (error) {
            console.log(
                yellow(`⚠️  Failed to start dev server: ${error.message}`)
            );
            console.log(gray('You can start it manually with:'));
            console.log(gray(`  cd ${projectName} && ${pm} run dev`));
        }
    }
}

if (import.meta.url === `file://${__filename}`) run();
