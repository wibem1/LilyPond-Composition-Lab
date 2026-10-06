\version "2.24.3"
\score { <<
\new Staff \with { midiInstrument = "violin" } { c''4 d''4 e''4 f''4 }
\new PianoStaff <<
\new Staff \with { midiInstrument = "acoustic grand" } { c'1 }
\new Staff \with { midiInstrument = "acoustic grand" } { \clef bass c1 }
>> >> \layout {} \midi { \tempo 4 = 90 } }
