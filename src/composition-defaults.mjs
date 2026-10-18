import {cleanGuidelines,OCTAVE_RULE,NOTATION_RULE} from './composition-workflow.mjs';

const ORIGINAL_SYSTEM="Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf.";
const TECHNICAL_SYSTEM="Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf. Technische Notation: Verwende absolute Tonhöhen mit ausdrücklich angegebenen Oktaven (ohne \\relative). Prüfe die tatsächlichen Oktavlagen; Verwende für jedes Instrument dessen spielbaren klingenden Tonumfang; für Klavier A0 bis C8. Diese Notationsregel macht keine Vorgaben zur musikalischen Gestaltung.";
const EXPRESSION_ADDITION=" Notiere die musikalisch sinnvollen Ausdruckszeichen direkt in der Partitur: Dynamik und ihre Verläufe, Artikulation und Phrasierungsbögen, zum Instrument passende Pedalangaben sowie Tempoveränderungen. Verwende Verzierungen, wenn sie musikalisch passen.";
const EXPRESSION_SYSTEM=ORIGINAL_SYSTEM+EXPRESSION_ADDITION;
const PREVIOUS_SYSTEM=EXPRESSION_SYSTEM+OCTAVE_RULE;
export const DEFAULT_SYSTEM=cleanGuidelines(PREVIOUS_SYSTEM+NOTATION_RULE);
// Only exact, unedited historical defaults are upgraded. These migrations keep
// old saved compositions usable; deliberate musical instructions are preserved.
const historicalDefaults=new Set([ORIGINAL_SYSTEM,TECHNICAL_SYSTEM,EXPRESSION_SYSTEM,PREVIOUS_SYSTEM]);
export function currentSystem(value){return !value||historicalDefaults.has(value)?DEFAULT_SYSTEM:value;}
