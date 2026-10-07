\version "2.24.3"
\header { title = "Trill tempo regression" }
\score { \new Staff { \tempo 4=60 c'2\trill d'2 | \tempo 4=132 e'2\startTrillSpan f'2\stopTrillSpan | g'4\mordent a'4\turn b'4\prall c''4 } \layout {} \midi {} }