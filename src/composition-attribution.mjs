import {mask} from './expression-playback.mjs';

// Attribution comes from the API call, never from the model's self-description.
export function compositionAttribution(source,model){
 if(!source.trim())return source;
 const name=String(model).replace(/[\r\n]/g,' ').trim();
 const composer='composer = "'+name.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
 const s=mask(source),edits=[];
 for(const match of s.matchAll(/\\header\s*\{/g)){
  const open=match.index+match[0].lastIndexOf('{');
  let depth=1,end=open+1;
  for(;end<s.length&&depth;end++){if(s[end]==='{')depth++;else if(s[end]==='}')depth--;}
  if(depth)continue;
  const close=end-1,fields=[];depth=0;
  for(let i=open+1;i<close;i++){
   if(s[i]==='{')depth++;
   else if(s[i]==='}')depth--;
   else if(!depth&&/[a-zA-Z]/.test(s[i])&&!/[a-zA-Z0-9_-]/.test(s[i-1])){
    const field=s.slice(i,close).match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*=/);
    if(field){fields.push({name:field[1],start:i});i+=field[0].length-1;}
   }
  }
  let found=false;
  for(let i=0;i<fields.length;i++)if(fields[i].name==='composer'){
   const start=fields[i].start,boundary=fields[i+1]?.start??close;
   const whitespace=source.slice(start,boundary).match(/\s*$/)[0];
   edits.push({start,end:boundary,text:composer+(whitespace||' ')});found=true;
  }
  if(!found)edits.push({start:close,end:close,text:'\n  '+composer+'\n'});
 }
 let code=source;
 for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
 if(!edits.length){
  const version=s.match(/\\version\b/);
  const newline=version?s.indexOf('\n',version.index):-1;
  const at=version?(newline<0?source.length:newline+1):0;
  code=code.slice(0,at)+'\n\\header { '+composer+' }\n'+code.slice(at);
 }
 return '% KI-Modell: '+name+'\n'+code;
}
