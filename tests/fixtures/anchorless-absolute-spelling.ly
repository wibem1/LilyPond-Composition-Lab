\version "2.24.3"
\header { title = "Octave reference test" }
right = \relative {
 \key c \minor
 c''4->( es'' g'' c''') |
 b''4 d''' g''2\turn |
 \acciaccatura as''8 g''4 f'' d'' c'' |
 <c' c''>4 <es' es''> <g' g''> <c'' c'''> |
}
left = \relative {
 \clef bass
 <c, c>4 <g,, g,> <c,, c,> <g,, g,> |
 <c,, c,>4 <g,, g,> <c,, c,> <g,, g,> |
 c,8 c c, c c, c c, c |
 <c,, c,>1 |
}
\score {
 \new PianoStaff <<
  \new Staff \with { midiInstrument = "acoustic grand" } \right
  \new Staff \with { midiInstrument = "acoustic grand" } \left
 >>
 \layout {} \midi { \tempo 4=100 }
}
