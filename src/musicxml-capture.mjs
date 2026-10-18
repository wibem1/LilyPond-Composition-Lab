import {mask} from './expression-playback.mjs';

// The real LilyPond parser resolves variables, relative pitches, durations and
// tuplets. Only this reduced semantic tree is transferred; no MIDI inference.
const prelude=String.raw`
#(define (labxml:quote value)
  (call-with-output-string (lambda (port)
    (display #\" port)
    (string-for-each (lambda (c)
      (cond ((char=? c #\") (display "\\\"" port))
            ((char=? c #\\) (display "\\\\" port))
            ((char=? c #\newline) (display "\\n" port))
            ((char=? c #\return) (display "\\r" port))
            ((char=? c #\tab) (display "\\t" port))
            ((< (char->integer c) 32) (display " " port))
            (else (display c port)))) value)
    (display #\" port))))
#(define (labxml:object pairs)
  (string-append "{" (string-join
    (map (lambda (p) (string-append (labxml:quote (symbol->string (car p))) ":" (labxml:value (cdr p)))) pairs) ",") "}"))
#(define (labxml:value value)
  (cond
    ((ly:music? value)
      (labxml:object (append
        (list (cons 'len (ly:moment-main (ly:music-length value))))
        (filter-map (lambda (key)
          (let ((v (ly:music-property value key)))
            (if (null? v) #f (cons key v))))
          '(name pitch duration elements element articulations text span-direction
            articulation-type symbol value context-type context-id create-new
            property-operations numerator denominator pitch-alist tonic
            tempo-unit metronome-count repeat-count time-signature ottava-number
            bar-type direction articulation-type tremolo-type grob-property-path grob-value)))) )
    ((ly:pitch? value)
      (labxml:object (list (cons 'step (ly:pitch-notename value))
        (cons 'octave (+ 4 (ly:pitch-octave value)))
        (cons 'alter (* 2 (ly:pitch-alteration value))))))
    ((ly:duration? value)
      (labxml:object (list (cons 'log (ly:duration-log value))
        (cons 'dots (ly:duration-dot-count value))
        (cons 'scale (ly:duration-scale value)))))
    ((ly:moment? value) (labxml:value (ly:moment-main value)))
    ((string? value) (labxml:quote value))
    ((symbol? value) (labxml:quote (symbol->string value)))
    ((boolean? value) (if value "true" "false"))
    ((number? value) (if (integer? value) (number->string value) (labxml:quote (number->string value))))
    ((list? value) (string-append "[" (string-join (map labxml:value value) ",") "]"))
    ((pair? value) (labxml:value (list (car value) (cdr value))))
    (else "null")))
labMusicXmlCapture = #(define-music-function (music) (ly:music?)
  (ly:message "LABXML-BEGIN~aLABXML-END" (labxml:value music))
  music)
`;
function endBrace(s,at){let depth=0;for(let i=at;i<s.length;i++){if(s[i]==='{')depth++;if(s[i]==='}'&&!--depth)return i;}throw Error('Unvollständiger score-Block.');}
export function musicXmlCapture(source){
 if(typeof source!=='string'||!source.trim()||source.length>200000)throw Error('Bitte einen vollständigen LilyPond-Notentext öffnen.');
 const masked=mask(source),scores=[...masked.matchAll(/\\score\s*\{/g)];
 if(scores.length!==1)throw Error('Der MusicXML-Export benötigt genau einen score-Block.');
 const match=scores[0],open=match.index+match[0].lastIndexOf('{'),end=endBrace(masked,open),remove=[];
 let depth=0;
 for(let i=open+1;i<end;i++){
  if(depth===0){const cmd=masked.slice(i).match(/^\\(layout|midi|header)\s*\{/);if(cmd){const to=endBrace(masked,i+cmd[0].lastIndexOf('{'));remove.push({start:i,end:to+1});i=to;continue;}}
  if(masked[i]==='{')depth++;if(masked[i]==='}')depth--;
 }
 let music=source.slice(open+1,end);
 for(const r of remove.reverse())music=music.slice(0,r.start-open-1)+music.slice(r.end-open-1);
 return prelude+'\n'+source.slice(0,match.index)+'\\score { \\labMusicXmlCapture \\unfoldRepeats {\n'+music+'\n} \\layout {} }'+source.slice(end+1);
}
export function capturedMusic(logs){
 const matches=[...String(logs||'').matchAll(/LABXML-BEGIN(.*?)LABXML-END/gs)];
 if(matches.length!==1)throw Error('Der Compiler hat keine eindeutige MusicXML-Notenstruktur geliefert.');
 try{return JSON.parse(matches[0][1]);}catch{throw Error('Die MusicXML-Notenstruktur ist unvollständig.');}
}
