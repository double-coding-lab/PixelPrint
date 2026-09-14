import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const codeOpts = {
  entryPoints: ['plugin/src/code.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  outfile: 'plugin/dist/code.js',
  logLevel: 'info',
};

const uiOpts = {
  entryPoints: ['plugin/src/ui/index.tsx'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  outfile: 'plugin/dist/ui.js',
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

function ensureDist() {
  const dist = 'plugin/dist';
  if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
}

function bundleHtml() {
  const uiJs = readFileSync('plugin/dist/ui.js', 'utf8');
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PixelPrint D2C Prep</title>
</head>
<body>
<div id="root"></div>
<script>${uiJs}</script>
</body>
</html>`;
  writeFileSync('plugin/dist/ui.html', html);
}

async function run() {
  ensureDist();
  if (watch) {
    const codeCtx = await context(codeOpts);
    const uiCtx = await context({
      ...uiOpts,
      plugins: [
        {
          name: 'rebuild-html',
          setup(b) {
            b.onEnd((res) => {
              if (!res.errors.length) bundleHtml();
            });
          },
        },
      ],
    });
    await Promise.all([codeCtx.watch(), uiCtx.watch()]);
    console.log('[plugin build] watching...');
  } else {
    await Promise.all([build(codeOpts), build(uiOpts)]);
    bundleHtml();
    console.log('[plugin build] done -> plugin/dist/{code.js,ui.html}');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
