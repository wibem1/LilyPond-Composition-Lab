import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.mjs')).sort();
for(const file of files){
 const args=[...(file==='workflow-ui.mjs'?['--experimental-vm-modules']:[]),'tests/'+file];
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS: '+files.length+' test programs completed.');
