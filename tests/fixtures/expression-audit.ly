\version "2.26.0"
\score {
 \new Staff \with { midiInstrument = "acoustic grand" } {
  \time 4/4 \tempo 4=60
  c'4 c'\staccato c'\staccatissimo c'\portato |
  c'4\tenuto c'( c' c') |
  c'4\mf c'\accent c'\marcato c' |
  c'4\p\< d' e' f'\f |
  g'1\p\< | g'1\f |
  c'2\fermata c'2 |
  c'2\glissando g'2 |
  c'4\mordent c'\prall c'\turn c'\reverseturn |
  c'2:16 \repeat tremolo 4 { c'16 e'16 } |
  c'4^\markup\italic "ritardando" d' e' f' |
  c'4^\markup\italic "a tempo" d' e' f' |
  c'4^"dolce" d'^"rubato" e'^"espressivo" f'^"cantabile" |
  c'4\sustainOn d' e' f'\sustainOff |
 }
 \layout {} \midi {}
}
