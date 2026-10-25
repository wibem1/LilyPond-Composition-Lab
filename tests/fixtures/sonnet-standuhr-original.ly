\version "2.24.0"
\language "nederlands"

\header {
  title = "Die alte Standuhr"
  subtitle = "Lyrisches Charakterstück für Klavier solo"
  composer = "Claude"
  tagline = ##f
}

\paper {
  #(set-paper-size "a4")
}

rightHand = \absolute {
  \clef treble
  \key g \minor
  \time 3/4
  \tempo "Andante con moto" 4=72

  % ===== A (Takte 1-8): Pendelmotiv, absteigende Sequenz g-f-es-d =====
  d''4--( g'4) bes'4 |
  c''4--( f'4) a'8( bes'8) |
  bes'4--( ees'4) g'8( a'8) |
  a'4--( d'4) fis'4-- |
  \acciaccatura { ees''8 } d''4--( g'4) bes'4 |
  ees''4--( g'4) c''4 |
  fis''4--( d''4) c''4-> |
  bes'4( a'4 g'4--) |

  % ===== B (Takte 9-16): Sing-Teil in B-Dur, Ausweichung über As zur Dominante =====
  \tempo "Poco più mosso" 4=76
  d''4.(^\markup { \italic "dolce, cantabile" } f''8 bes''4) |
  a''4.( g''8 f''4) |
  g''4.( f''8 ees''4) |
  d''4( ees''8 f''8 g''4) |
  c'''4.(-> bes''8 aes''4) |
  ees''4.( g''8 a''4) |
  g''4(^\markup { \italic "poco rit." } e''4 cis''4) |
  d''4( fis''4 c''4) |

  % ===== A' (Takte 17-24): Thema in Oktaven, strahlend =====
  \tempo "Tempo I" 4=72
  <d'' d'''>4--( <g' g''>4) <bes' bes''>4 |
  <c'' c'''>4--( <f' f''>4) <a' a''>8( <bes' bes''>8) |
  <bes' bes''>4--( <ees' ees''>4) <g' g''>8( <a' a''>8) |
  <a' a''>4--( <d' d''>4) <fis' fis''>4-- |
  \acciaccatura { <ees'' ees'''>8 } <d'' d'''>4--( <g' g''>4) <bes' bes''>4 |
  <ees'' ees'''>4--( <g' g''>4) <c'' c'''>4 |
  <fis'' fis'''>4--( <d'' d'''>4) <c'' c'''>4-> |
  <bes' bes''>4(^\markup { \italic "poco rit." } <a' a''>4 <g' g''>4--) |

  % ===== Coda (Takte 25-32): Die Uhr schlägt und verklingt =====
  \tempo "Più calmo" 4=66
  bes''4--( g''4 d''4) |
  ees''4--( c''4 g'4) |
  c''4--(^\markup { \italic "poco rit." } a'4 fis'4) |
  bes'4( a'4 g'4--) |
  \tempo "Lento" 4=54
  r4 <bes' d''>4-. r4 |
  r4 <g' bes'>4-. r4 |
  r4 <d' g'>4-. r4 |
  <bes' d'' g''>2.\fermata |
}

leftHand = \absolute {
  \clef bass
  \key g \minor
  \time 3/4

  % ===== A =====
  g,4-- r8 <bes d'>8-. r8 <bes d'>8-. |
  f,8( c8 f8 a8 c'8 a8) |
  ees,8( bes,8 g,8 bes,8 ees8 g8) |
  d,8( a,8 d8 fis8 a8 fis8) |
  \acciaccatura { s8 } g,4-- r8 <bes d'>8-. r8 <bes d'>8-. |
  c,8( g,8 c8 ees8 g8 ees8) |
  d,4-- <fis c'>4-. <fis c'>4-. |
  g,4-- <d g bes>2 |

  % ===== B =====
  bes,8( f8 bes8 d'8 f'8 d'8) |
  f,8( c8 a8 c'8 ees'8 c'8) |
  ees,8( bes,8 g8 bes8 ees'8 d'8) |
  c,8( g,8 c8 ees8 g8 bes8) |
  aes,8( ees8 aes8 c'8 ees'8 c'8) |
  c,8( g,8 c8 ees8 a8 g8) |
  a,8( e8 g8 cis'8 e'8 cis'8) |
  d,8( a,8 d8 fis8 c'8 a8) |

  % ===== A' =====
  g,,8( d,8 g,8 bes,8 d8 g8) |
  f,,8( c,8 f,8 a,8 c8 f8) |
  ees,,8( bes,,8 ees,8 g,8 bes,8 ees8) |
  d,,8( a,,8 d,8 fis,8 a,8 d8) |
  \acciaccatura { s8 } g,,8( d,8 bes,8 d8 g8 bes8) |
  c,8( g,8 c8 ees8 g8 c'8) |
  d,,8( a,,8 d,8 fis,8 a,8 c8) |
  g,,2 <d g bes>4 |

  % ===== Coda =====
  g,4-- r8 <bes d'>8-. r8 <bes d'>8-. |
  c,4-- r8 <ees g>8-. r8 <ees g>8-. |
  d,4-- r8 <fis c'>8-. r8 <fis c'>8-. |
  g,4-- r8 <bes d'>8-. r8 <d g>8-. |
  <g,, g,>2.-> |
  <g,, d,>2.-- |
  <g,, g,>2.-- |
  <g,, g, d>2.\arpeggio\fermata |
}

dynamicsTrack = {
  \set Dynamics.pedalSustainStyle = #'mixed

  % ===== A =====
  s2.\p |
  s4\sustainOn\< s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn\mp\> s4 s4\sustainOff |
  \acciaccatura { s8 } s4\p\< s2 |
  s4\sustainOn s2 |
  s4\sustainOff\mf s2 |
  s4\sustainOn\> s2 |

  % ===== B =====
  s4\sustainOff\sustainOn\mp s2 |
  s4\sustainOff\sustainOn\< s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn\f s2 |
  s4\sustainOff\sustainOn\> s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn\p s4\< s4 |

  % ===== A' =====
  s4\sustainOff\sustainOn\mf s2 |
  s4\sustainOff\sustainOn\< s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn\f\> s2 |
  \acciaccatura { s8 } s4\sustainOff\sustainOn\mf\< s2 |
  s4\sustainOff\sustainOn s2 |
  s4\sustainOff\sustainOn\f\> s2 |
  s4\sustainOff\sustainOn\mp\> s4 s4 |

  % ===== Coda =====
  s4\sustainOff\p s2 |
  s2. |
  s4\> s2 |
  s4\pp s2 |
  s4\sustainOn\p s2 |
  s4\sustainOff\sustainOn\pp s2 |
  s4\sustainOff\sustainOn\ppp s2 |
  s4\sustainOff\sustainOn\pp s2 <>\sustainOff |
}

\score {
  \new PianoStaff \with { instrumentName = "Klavier" } <<
    \new Staff = "right" {
      \set Staff.midiInstrument = "acoustic grand"
      \rightHand
    }
    \new Dynamics = "dynamics" \dynamicsTrack
    \new Staff = "left" {
      \set Staff.midiInstrument = "acoustic grand"
      \leftHand
    }
  >>
  \layout {
    \context {
      \Score
      \override SpacingSpanner.common-shortest-duration = #(ly:make-moment 1/8)
    }
  }
  \midi { }
}