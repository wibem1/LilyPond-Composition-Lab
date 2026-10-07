// Read actual compiler diagnostics even when the renderer supplies SVG and MIDI.
export function compilerDiagnostics(logs=''){
 const lines=String(logs).split(/\r?\n/);
 const errors=[...new Set(lines.filter(x=>/\b(?:fatal error|error):|compilation failed/i.test(x)))];
 const warnings=[...new Set(lines.filter(x=>/\bwarning:/i.test(x)))];
 return {status:errors.length?'error':warnings.length?'warning':'passed',errors,warnings,summary:[...errors,...warnings].join('\n')};
}
