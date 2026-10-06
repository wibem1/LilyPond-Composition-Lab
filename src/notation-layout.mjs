// InstrumentName is a spanner split into one piece per system. Keep the
// first piece's standard LilyPond stencil and suppress only its continuations.
// This also handles markup names, groups, and systems on later pages.
export function initialInstrumentNames(source){
 const stencil=`#(lambda (grob)
   (let ((parts (ly:spanner-broken-into (ly:grob-original grob))))
     (if (or (null? parts) (eq? grob (car parts)))
       (system-start-text::print grob)
       #f)))`;
 const contexts=['Staff','PianoStaff','GrandStaff','StaffGroup','ChoirStaff','TabStaff','DrumStaff','RhythmicStaff'];
 const layout='\n% App layout: instrument names only on the first system\n\\layout {\n'+contexts.map(c=>`  \\context { \\${c} \\override InstrumentName.stencil = ${stencil} }`).join('\n')+'\n}\n';
 const version=source.match(/^\s*\\version\s+"[^"\n]+"[^\n]*(?:\n|$)/);
 const at=version?.[0].length||0;
 return source.slice(0,at)+layout+source.slice(at);
}
