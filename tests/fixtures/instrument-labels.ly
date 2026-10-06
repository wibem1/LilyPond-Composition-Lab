\version "2.24.3"
\header { title = "Instrumentenbeschriftung – Satztest" tagline = ##f }
melody = { c''1 \break d''1 \pageBreak e''1 }
\score {
 <<
  \new Staff \with { instrumentName = \markup { "Violine" } shortInstrumentName = \markup { "Vln." } midiInstrument = "violin" } \melody
  \new PianoStaff \with { instrumentName = "Klavier" shortInstrumentName = "Klav." } <<
   \new Staff \with { midiInstrument = "acoustic grand" } \melody
   \new Staff \with { midiInstrument = "acoustic grand" } { \clef bass c1 d1 e1 }
  >>
 >>
 \layout { }
 \midi { }
}
