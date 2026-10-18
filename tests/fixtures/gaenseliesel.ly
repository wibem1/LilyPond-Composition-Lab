% KI-Modell: google/gemini-4-argon
\version "2.24.0"

\header {
  title = "Gänseliesel"
  subtitle = "Charakterstück für Klavier"
  tagline = ##f

  composer = "google/gemini-4-argon"
}

global = {
  \key f \major
  \time 2/4
  \tempo "Allegretto grazioso" 4 = 104
}

rightHand = \absolute {
  \global
  \clef treble

  % Takt 1-4
  \acciaccatura { g''8 } f''8^\markup { \italic "leggiero e scherzando" }( c''8) a'8-. c''8-. |
  d''16( e''16 f''16 d''16 c''8-.) a'8-. |
  bes'8( g'8) c''8( e''8) |
  g''16( f''16 e''16 d''16 c''8-.) r8 |

  % Takt 5-8
  \acciaccatura { g''8 } f''8( c''8) a'8-. c''8-. |
  d''16( e''16 f''16 g''16 a''8-.) f''8-. |
  g''16( f''16 e''16 d''16 c''8-.) <bes' e''>8-. |
  <a' f''>4( <f' f''>8-.) r8 |

  % Takt 9-12
  \acciaccatura { e''8 } <d'' f''>8-. <d'' f''>8-. \acciaccatura { e''8 } <d'' f''>8( a'8) |
  bes'16( a'16 g'16 a'16 bes'8-.) g'8-. |
  \acciaccatura { d''8 } <cis'' e''>8-. <cis'' e''>8-. \acciaccatura { d''8 } <cis'' e''>8( a'8) |
  f''16( e''16 d''16 cis''16 d''8-.) a'8( |

  % Takt 13-16
  d''4~^\markup { \italic "cantabile" } d''16 c''16 bes'16 a'16 |
  g'8 fis'16 g'16 bes'8 a'16 g'16 |
  f'8 e'16 f'16 a'8 g'16 f'16 |
  e'8-.) <e' c''>8-.( <f' d''>8-. <g' e''>8-.) |

  % Takt 17-20
  f''16( e''16 d''16 c''16 bes'16 a'16 g'16 f'16) |
  \acciaccatura { fis''8 } <e'' g''>8-. <e'' g''>8-. <c'' e''>16( d''16 e''16 c''16) |
  g''16( f''16 e''16 d''16 c''16 bes'16 a'16 g'16) |
  \acciaccatura { gis''8 } <f'' a''>8-. <f'' a''>8-. <d'' f''>16( e''16 f''16 d''16) |

  % Takt 21-24
  \acciaccatura { fis''8 } <e'' g''>8-.( <c'' e''>8-.) \acciaccatura { d''8 } <bes' c''>8-.( <g' bes'>8-.) |
  a'16( gis'16 a'16 bes'16 c''16 d''16 e''16 f''16) |
  \acciaccatura { a''8 } g''8-.( e''8-.) \acciaccatura { f''8 } e''8-.( d''8-.) |
  c''8(^\markup { \italic "poco rit." } cis''8 d''8 e''8) |

  % Takt 25-28
  \acciaccatura { g''8 } f''8(^\markup { \italic "a tempo" } c''8) a'8-. c''8-. |
  d''16( e''16 f''16 g''16 a''8-.) f''8-. |
  g''16( f''16 e''16 d''16 c''8-.) <bes' e''>8-. |
  f''16( e''16 f''16 g''16 a''8-.) <f'' a''>8-. |

  % Takt 29-32
  bes''16( a''16 g''16 f''16 e''16 d''16 c''16 bes'16) |
  a'16(^\markup { \italic "poco rit." } gis'16 a'16 c''16 <bes' d''>8-.) <g' e''>8-. |
  \acciaccatura { g''8 } f''8-.(^\markup { \italic "a tempo" } c''8-.) \acciaccatura { d''8 } c''8-.( a'8-.) |
  \acciaccatura { g''8 } <a' c'' f''>8-. r8 <f' a' f''>8-. r8 \bar "|."
}

leftHand = \absolute {
  \global
  \clef bass

  % Takt 1-4
  \grace { s8 } <f c'>8-. <a c'>8-. <f d'>8-. <f a>8-. |
  <bes, f>8-. <bes, g>8-. <f, c a>8-. r8 |
  c8-. <g bes>8-. c8-. <g bes>8-. |
  <f a>8-. <g bes>8-. <a c'>8-. <g bes>8-. |

  % Takt 5-8
  \grace { s8 } <f c'>8-. <a c'>8-. <f d'>8-. <f a>8-. |
  <bes, f d'>8-. <a, f c'>8-. <g, f bes>8-. <a, f c'>8-. |
  <bes, g d'>8-. <b, g d'>8-. <c g bes>8-. <c, c>8-. |
  <f, c a>8-. c8-. f,8-. r8 |

  % Takt 9-12
  \grace { s8 } d8-. a8-. \grace { s8 } f8-. d8-. |
  g,8-. d8-. g8-. d8-. |
  \grace { s8 } a,8-. e8-. \grace { s8 } g8-. e8-. |
  d8-. a,8-. d,8-. r8 |

  % Takt 13-16
  bes,16(\sustainOn f16 d'16 f16 bes,16 f16 d'16 f16)\sustainOff |
  ees16(\sustainOn g16 c'16 g16\sustainOff d16\sustainOn g16 bes16 g16)\sustainOff |
  cis16(\sustainOn g16 a16 g16\sustainOff d16\sustainOn f16 b16 f16)\sustainOff |
  c16( g16 c'16 g16 c8-.) <bes, g>8-. |

  % Takt 17-20
  <a, f>8-. <a, f>8-. <bes, d>8-. <b, d>8-. |
  \grace { s8 } c8-. <g bes>8-. <c a>8-. <c g>8-. |
  <b, f g>8-. <b, f g>8-. <c e g>8-. <cis e a>8-. |
  \grace { s8 } d8-. <f a>8-. <b, f g>8-. <g, f>8-. |

  % Takt 21-24
  \grace { s8 } <c g>8-. r8 \grace { s8 } <e, c>8-. r8 |
  <f, c>8-. <g, c>8-. <a, c>8-. <bes, c>8-. |
  \grace { s8 } <c g bes>8-. r8 \grace { s8 } <c g bes>8-. r8 |
  <c e g>8-. <bes, e g>8-. <a, c g>8-. <g, c e>8-. |

  % Takt 25-28
  \grace { s8 } f16(\sustainOn c'16 a16 c'16\sustainOff d16\sustainOn c'16 f16 c'16)\sustainOff |
  bes,16(\sustainOn f16 d'16 f16\sustainOff a,16\sustainOn f16 c'16 f16)\sustainOff |
  g,16(\sustainOn d16 bes16 d16\sustainOff c16\sustainOn g16 bes16 g16)\sustainOff |
  d16(\sustainOn a16 f'16 a16\sustainOff c16\sustainOn a16 f'16 a16)\sustainOff |

  % Takt 29-32
  <bes, f d'>8-. <b, f d'>8-. <c f a>8-. <cis e a>8-. |
  <d f a>8-. <ees fis c'>8-. <d g bes>8-. <c bes>8-. |
  \grace { s8 } <f, c a>8-. r8 \grace { s8 } <c e g>8-. r8 |
  \grace { s8 } <f, c f>8-. r8 <f,, f,>8-. r8 \bar "|."
}

dynamics = {
  % Takt 1-4
  \grace { s8 } s2\p |
  s2 |
  s4\< s8. s16\! |
  s4\> s8. s16\! |

  % Takt 5-8
  \grace { s8 } s2\mp |
  s4\< s8. s16\! |
  s2\mf |
  s4\> s8. s16\! |

  % Takt 9-12
  \grace { s8 } s4\p \grace { s8 } s4 |
  s2 |
  \grace { s8 } s4 \grace { s8 } s4 |
  s4 s8\< s8\! |

  % Takt 13-16
  s2\mp |
  s2 |
  s4\< s8. s16\! |
  s8\mf s8\< s8 s8\! |

  % Takt 17-20
  s2\f |
  \grace { s8 } s2 |
  s2 |
  \grace { s8 } s2 |

  % Takt 21-24
  \grace { s8 } s4\mf \grace { s8 } s4 |
  s4\< s8. s16\! |
  \grace { s8 } s4\> \grace { s8 } s8. s16\! |
  s4\p\< s8. s16\! |

  % Takt 25-28
  \grace { s8 } s2\mp |
  s4\< s8. s16\! |
  s2\mf |
  s4\< s8. s16\! |

  % Takt 29-32
  s4\f\> s8. s16\! |
  s4\mp\> s8. s16\! |
  \grace { s8 } s4\p \grace { s8 } s4 |
  \grace { s8 } s4\pp s4
}

\score {
  \new PianoStaff \with {
    instrumentName = "Klavier"
  } <<
    \new Staff = "right" \with {
      midiInstrument = "acoustic grand"
    } \rightHand
    \new Dynamics \dynamics
    \new Staff = "left" \with {
      midiInstrument = "acoustic grand"
    } \leftHand
  >>
  \layout {
    \context {
      \Score
      \override SpacingSpanner.base-shortest-duration = #(ly:make-moment 1/16)
    }
  }
  \midi {}
}