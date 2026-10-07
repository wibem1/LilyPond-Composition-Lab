\version "2.24.3"
\header { title = "Synthetic expression test" }
\score { \new Staff \relative c' { \tempo 4 = 60 c4\p( d e f) | g4-. a-- b-> c | c4^\markup { \italic "ritardando" } b a g | f4^"a tempo" e d c\pp } \layout {} \midi {} }
