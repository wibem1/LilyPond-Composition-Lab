// Read actual compiler diagnostics even when the renderer supplies SVG and MIDI.
export function compilerDiagnostics(logs=''){
 const lines=String(logs).split(/\r?\n/);
 const errors=[...new Set(lines.filter(x=>/\b(?:fatal error|error):|compilation failed/i.test(x)))];
 const warnings=[...new Set(lines.filter(x=>/\bwarning:/i.test(x)))];
 return {status:errors.length?'error':warnings.length?'warning':'passed',errors,warnings,summary:[...errors,...warnings].join('\n')};
}

// A narrow LilyPond internal layout failure can still produce usable outputs.
// Never suppress unrelated compiler errors or accept missing score/MIDI assets.
export function recoverableLayoutError(logs='',result={}){
 const diagnostics=compilerDiagnostics(logs);
 if(diagnostics.status!=='error'||result.err)return false;
 if(!diagnostics.errors.length||!diagnostics.errors.every(line=>/programming error: bounds of this piece aren't breakable\./.test(line)))return false;
 if(!Array.isArray(result.files)||!result.files.some(file=>typeof file==='string'&&file.includes('<svg')))return false;
 if(typeof result.midi!=='string'||!result.midi.length)return false;
 return true;
}
