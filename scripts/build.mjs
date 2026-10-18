import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {APP_VERSION,RELEASE_DATE} from '../src/app-config.mjs';
const assets=JSON.parse(await readFile('worker/assets.json','utf8'));
assets['/soundfont-player.mjs']={text:await readFile('src/player-adapter.mjs','utf8')+'\n'+await readFile('src/midi-reader.mjs','utf8'),type:'text/javascript; charset=utf-8'};
for(const [url,file,type] of [['/app.mjs','app/app.mjs','text/javascript'],['/style.css','app/style.css','text/css']])assets[url]={text:await readFile(file,'utf8'),type:type+'; charset=utf-8'};
for(const name of ['composition-recovery','run-client','composition-costs','soundfont-cache','composition-workflow','composition-defaults','app-config']){
 assets['/'+name+'.mjs']={text:await readFile('src/'+name+'.mjs','utf8'),type:'text/javascript; charset=utf-8'};
}
const PAGE=(await readFile('app/index.html','utf8')).replaceAll('{{VERSION}}',APP_VERSION).replaceAll('{{RELEASE_DATE}}',RELEASE_DATE);
await writeFile('worker/generated.js','export const PAGE='+JSON.stringify(PAGE)+';\nexport const ASSETS='+JSON.stringify(assets)+';\n');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',target:'es2022'});
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built LilyPond Composition Lab.');
