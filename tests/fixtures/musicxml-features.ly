\version "2.26.0"
\header { title = "Exportprüfung" composer = "Test" }
\score { \new PianoStaff <<
 \new Staff { \time 3/4 \key d \minor \clef treble \tempo 4=88
   \partial 4 <d' f'>4\p( |
   \tuplet 3/2 {d'8 e' f'} <g' bes'>4~ <g' bes'>4) |
   \ottava #1 c'''4 d''' e''' \ottava #0 |
   \time 2/4 \key g \major fis''4-. e''4-> |
   << {d''2} \\ {a'4 b'} >> | R2*2 \bar "|."
 }
 \new Staff {\clef bass \time 3/4 \key d \minor \partial 4 d4 | d2. | c2. | \time 2/4 \key g \major g,2 | g,2 | R2*2}
 >> \layout {} \midi {} }
