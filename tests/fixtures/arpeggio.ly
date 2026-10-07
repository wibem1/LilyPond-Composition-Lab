\version "2.24.3"
\header { title = "Synthetic arpeggio regression" }
\score { \new PianoStaff <<
 \new Staff {
  \tempo 4=60
  <c' e' g'>2\arpeggio <c' e' g'>2 |
  \arpeggioArrowDown <c' e' g'>2\arpeggio
  \arpeggioNormal <c' e' g'>2\arpeggio |
  \arpeggioBracket <c' e' g'>2\arpeggio
  \arpeggioNormal <c' e' g'>2\arpeggio |
  \once \arpeggioArrowDown <c' e' g'>2\arpeggio <c' e' g'>2\arpeggio |
  \set PianoStaff.connectArpeggios = ##t <c' e' g'>1\arpeggio |
  \set PianoStaff.connectArpeggios = ##f <c' e' g'>1\arpeggio |
  \tempo 4=180 <c' e' g'>16\arpeggio r16 r8 r2. |
  \tempo 4=60 <c' e' g'>2\nonArpeggiato <c' e' g'>2\arpeggio |
  \once \set PianoStaff.connectArpeggios = ##t <c' e' g'>2\arpeggio <c' e' g'>2\arpeggio |
  \set PianoStaff.connectArpeggios = ##t
  \override PianoStaff.Arpeggio.arpeggio-direction = #DOWN <c' e' g'>1\arpeggio |
  \set PianoStaff.connectArpeggios = ##f
  \arpeggioNormal <c' e' g'>2\arpeggio~ <c' e' g'>2 |
  <c' e' g'>2\arpeggio\p\sustainOn <c' e' g'>2\arpeggio\f\sustainOff |
 }
 \new Staff {
  \clef bass s1*4
  <c e g>1\arpeggio | <c e g>1\arpeggio | s1*2 |
  <c e g>2\arpeggio <c e g>2\arpeggio |
  <c e g>1\arpeggio | s1*2 |
 }
 >> \layout {} \midi {} }
