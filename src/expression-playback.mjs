import {arpeggioPrelude} from './arpeggio-playback.mjs';
import {trillPrelude} from './trill-playback.mjs';
// Render the untouched score and a separate, articulated MIDI-only score.
// Mask strings/comments/Scheme so braces and commands in them are never edited.
export function mask(source){
 const out=source.split('');let i=0;
 const blank=(a,b)=>{for(let p=a;p<b;p++)if(out[p]!=='\n')out[p]=' ';};
 while(i<source.length){const start=i;
  if(source[i]==='"'){i++;while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i++]==='"')break;}blank(start,i);}
  else if(source.startsWith('%{',i)){let depth=1;i+=2;while(i<source.length&&depth){if(source.startsWith('%{',i)){depth++;i+=2;}else if(source.startsWith('%}',i)){depth--;i+=2;}else i++;}blank(start,i);}
  else if(source[i]==='%'){while(i<source.length&&source[i]!=='\n')i++;blank(start,i);}
  else if(source.startsWith('#(',i)||source.startsWith('$(',i)){let depth=1;i+=2;while(i<source.length&&depth){if(source[i]==='"'){i++;while(i<source.length){if(source[i]==='\\')i+=2;else if(source[i++]==='"')break;}}else if(source[i]===';'){while(i<source.length&&source[i]!=='\n')i++;}else {if(source[i]==='(')depth++;if(source[i]===')')depth--;i++;}}blank(start,i);}
  else i++;
 }return out.join('');
}
function closeBrace(s,at){let depth=0;for(let i=at;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&!--depth)return i;}throw Error('Unvollständiger score-Block.');}
const prelude=String.raw`
% App playback only: original notation is kept in the first score.
\include "articulate.ly"
% Keep unmarked notes almost full length; slurs and tenuto retain full length.
#(set! ac:normalFactor '(15 . 16))
${trillPrelude}
${arpeggioPrelude}
#(define (lab-expression-words value)
   (cond ((string? value) (list value))
         ((pair? value) (append-map lab-expression-words value))
         (else '())))
labExpressionText = #(define-music-function (music) (ly:music?)
 (music-map
  (lambda (m)
   (if (eq? (ly:music-property m 'name) 'TextScriptEvent)
    (let* ((text (string-downcase (string-join
                   (lab-expression-words (ly:music-property m 'text)) " ")))
           (known (cond
             ((member text '("rit" "rit." "ritard" "ritard." "ritardando" "rall" "rall." "rallentando")) "rit.")
             ((member text '("accel" "accel." "accelerando")) "accel.")
             ((member text '("poco rit." "poco ritardando" "poco rall." "poco rallentando")) "poco rit.")
             ((member text '("poco accel." "poco accelerando")) "poco accel.")
             ((member text '("a tempo" "tempo i")) "a tempo")
             (else #f))))
     (if known (ly:music-set-property! m 'text known))))
   m)
  (ly:music-deep-copy music)))
`;
export function expressionPlayback(source){
 const s=mask(source);
 // Respect an explicit performance setup supplied by the author.
 if(/\\articulate\b/.test(s)||[...s.matchAll(/\\include\b/g)].some(m=>/^\s*"articulate\.ly"/.test(source.slice(m.index+m[0].length))))return {code:source,mode:'author',scores:0};
 const edits=[];let scores=0;
 for(const match of s.matchAll(/\\score\s*\{/g)){
  if(edits.some(e=>match.index<e.end))continue;
  const open=match.index+match[0].lastIndexOf('{'),end=closeBrace(s,open);
  const removals=[],midi=[];let depth=0;
  for(let i=open+1;i<end;i++){
   if(depth===0&&s[i]==='\\'){
    const cmd=s.slice(i).match(/^\\(layout|midi|header)\s*\{/);
    if(cmd){const a=i+cmd[0].lastIndexOf('{'),b=closeBrace(s,a);removals.push({start:i,end:b+1,type:cmd[1]});if(cmd[1]==='midi')midi.push(source.slice(i,b+1));i=b;continue;}
   }
   if(s[i]==='{')depth++;else if(s[i]==='}')depth--;
  }
  if(!midi.length)continue;
  let music=source.slice(open+1,end),printed=source.slice(match.index,end+1);
  for(const r of [...removals].reverse())music=music.slice(0,r.start-open-1)+music.slice(r.end-open-1);
  for(const r of [...removals].reverse())if(r.type==='midi')printed=printed.slice(0,r.start-match.index)+printed.slice(r.end-match.index);
  edits.push({start:match.index,end:end+1,text:printed+'\n\\score {\n  \\labArpeggioPlayback \\articulate \\labTrillSetup \\labExpressionText \\unfoldRepeats {\n'+music+'\n  }\n'+midi.join('\n')+'\n}\n'});scores++;
 }
 if(!scores)return {code:source,mode:'basic',scores:0};
 let code=source;for(const e of edits.reverse())code=code.slice(0,e.start)+e.text+code.slice(e.end);
 const version=code.match(/^\s*\\version\s+"[^"\n]+"[^\n]*(?:\n|$)/);const at=version?.[0].length||0;
 code=code.slice(0,at)+prelude+code.slice(at);
 return {code,mode:'articulate',scores};
}
