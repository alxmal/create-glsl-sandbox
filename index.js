#!/usr/bin/env node
/**
 * create-glsl-sandbox — local CLI to scaffold a Shadertoy-like playground.
 *
 * Usage (after npm link):
 *   create-glsl-sandbox              # interactive
 *   create-glsl-sandbox my-sandbox   # with name
 *   create-glsl-sandbox --template three --pm npm --ts false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import child_process from 'node:child_process';
import prompts from 'prompts';
import { cyan, green, yellow, gray, bold } from 'kolorist';

// --- run helpers ---
const runCmd = (cmd, args, cwd) => child_process.spawnSync(cmd, args, { stdio: 'inherit', cwd });
const detectPM = () => {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  if (ua.startsWith('bun')) return 'bun';
  return 'npm';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Helpers ----------
const write = (dest, content) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
};

const pkg = (name) => ({
  name,
  version: '0.0.1',
  private: true,
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    preview: 'vite preview'
  },
  dependencies: {
    three: '^0.160.0'
  },
  devDependencies: {
    vite: '^5.4.0'
  }
});

const viteConfig = () => `import { defineConfig } from 'vite';
export default defineConfig({
  server: { open: true },
});
`;

const indexHtml = (title) => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>html,body{height:100%;margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;

const mainJs = (useTS) => `import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  iTime:       { value: 0.0 },
  iResolution: { value: new THREE.Vector3(1,1,1) },
};

const vert = /* glsl */`
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const frag = /* glsl */`
precision highp float;
uniform vec3  iResolution; // (width, height, pixelAspect)
uniform float iTime;
varying vec2  vUv;

// === Your Shadertoy code goes into mainImage ===
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 u = (fragCoord - 0.5*iResolution.xy) / iResolution.y;
  float t = iTime;
  vec3 col = 0.5 + 0.5*cos(6.2831*(u.xyx + vec3(0.0,0.33,0.67)) + t);
  fragColor = vec4(col, 1.0);
}

void main(){
  vec2 fragCoord = vUv * iResolution.xy;
  vec4 color; mainImage(color, fragCoord);
  gl_FragColor = color;
}
`;

const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
scene.add(quad);

const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  uniforms.iResolution.value.set(w*dpr, h*dpr, 1.0);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function tick(){
  uniforms.iTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
`;

const readme = (name) => `# ${name}\n\n**Commands**\n\n- \`npm run dev\` — start Vite dev server\n- \`npm run build\` — production build\n- \`npm run preview\` — preview build\n\nEdit \`src/main.js\`: put your Shadertoy \`mainImage\` body in the fragment shader.\n`;

// ---------- CLI ----------
async function run(){
  const argName = process.argv.find(a => !a.startsWith('-') && !a.endsWith('.js'));
  const args = Object.fromEntries(process.argv.filter(a=>a.startsWith('--')).map(a=>a.replace(/^--/, '')).map(kv=>{
    const [k,v] = kv.split('='); return [k, v ?? true];
  }));

  const answers = await prompts([
    { name: 'projectName', type: argName ? null : 'text', message: 'Project name', initial: 'glsl-sandbox' },
    { name: 'template',    type: args.template ? null : 'select', message: 'Template', choices: [
      { title: 'Three.js + Vite (Shadertoy-style)', value: 'three' },
      { title: 'Raw WebGL + Vite (minimal)', value: 'raw' }
    ], initial: 0 },
    { name: 'ts',          type: args.ts ? null : 'toggle', message: 'TypeScript?', initial: false, active: 'yes', inactive: 'no' },
    { name: 'pm',          type: args.pm ? null : 'select', message: 'Package manager', choices: [
      { title: 'npm', value: 'npm' },
      { title: 'pnpm', value: 'pnpm' },
      { title: 'yarn', value: 'yarn' },
      { title: 'bun', value: 'bun' }
    ], initial: 0 }
  ], {
    onCancel: () => { console.log(gray('Cancelled.')); process.exit(1); }
  });

  const projectName = (argName || answers.projectName || 'glsl-sandbox').trim();
  const template = (args.template || answers.template || 'three');
  const ts = (args.ts === 'true') || (args.ts === true) || answers.ts;
  const pm = (args.pm || answers.pm || detectPM());

  const root = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(root) && fs.readdirSync(root).length){
    console.log(yellow(`Directory ${projectName} is not empty.`));
    process.exit(1);
  }
  fs.mkdirSync(root, { recursive: true });

  // write files
  write(path.join(root, 'package.json'), JSON.stringify(pkg(projectName), null, 2) + '\n');
  write(path.join(root, 'vite.config.js'), viteConfig());
  write(path.join(root, 'index.html'), indexHtml(projectName));
  write(path.join(root, 'src/main.js'), mainJs(ts));
  write(path.join(root, '.gitignore'), ['node_modules','dist','.DS_Store'].join('\n'));
  write(path.join(root, 'README.md'), readme(projectName));

  const autoInstall = !(args['no-install'] || args.noInstall);
  console.log(`\n${bold(cyan('Scaffolded'))} ${projectName} in ${root}`);
  if (autoInstall) {
    console.log(`\nInstalling dependencies with ${pm}...`);
    runCmd(pm, ['install'], root);
  } else {
    console.log(`\nNext steps:`);
    console.log(`  ${green('cd')} ${projectName}`);
    console.log(`  ${green(pm)} install`);
  }
  console.log(`  ${green(pm)} run dev`);
  console.log(`\nEdit ${cyan('src/main.js')} fragment shader mainImage().`);

  if (args.run) {
    const runArgs = pm === 'yarn' ? ['dev'] : ['run','dev'];
    runCmd(pm, runArgs, root);
  }

  console.log(`\n${bold(cyan('Scaffolded'))} ${projectName} in ${root}`);
  console.log(`\nNext steps:`);
  console.log(`  ${green('cd')} ${projectName}`);
  console.log(`  ${green(pm)} install`);
  console.log(`  ${green(pm)} run dev`);
  console.log(`\nEdit ${cyan('src/main.js')} fragment shader mainImage().`);
}

if (import.meta.url === `file://${__filename}`) run();
