\version "2.24.3"
\header { title = "Synthetic musical trill regression" }
\score {
 \new StaffGroup << \new Staff {
  \tempo 4=60
  c'2\trill d'2 |
  \key f \major a'2\trill r2 |
  \key c \major \pitchedTrill e'2\startTrillSpan fis' r2\stopTrillSpan |
  <c' e' g'>2\trill r2 |
  \labTrillFromUpper { c'2\trill } r2 |
  \afterGrace c'2\trill { b16 c'16 } r2 |
  \tempo 4=132 c'8\trill r8 r2. |
  e'2\startTrillSpan f'2\stopTrillSpan |
  \tempo 4=60 \appoggiatura d'16 c'2\trill r2 |
  \appoggiatura c'16 c'2\trill r2 |
  \key f \major a'2\trill r2 |
 }
 \new Staff { \tempo 4=60 s1*6 \tempo 4=132 s1*2 \tempo 4=60 s1*2 \key g \major e'2\trill r2 }
 >>
 \layout {} \midi {}
}
