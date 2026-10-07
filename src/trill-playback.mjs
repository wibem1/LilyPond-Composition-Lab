// MIDI-only realization. The printed score and author-supplied articulate setup stay intact.
export const trillPrelude=String.raw`
% Principal-note start is the default; historical upper-note starts are explicit.
labTrillFromUpper = #(define-music-function (music) (ly:music?)
  (music-map (lambda (m) (ly:music-set-property! m 'lab-start-upper #t) m) music))
labTrillFromMain = #(define-music-function (music) (ly:music?)
  (music-map (lambda (m) (ly:music-set-property! m 'lab-start-upper #f) m) music))
#(define (lab:notes m)
  (filter (lambda (n) (eq? (ly:music-property n 'name) 'NoteEvent))
          (ly:music-property m 'elements)))
#(define (lab:highest notes)
  (car (sort (list-copy notes)
    (lambda (a b) (> (ly:pitch-semitones (ly:music-property a 'pitch))
                    (ly:pitch-semitones (ly:music-property b 'pitch)))))))
#(define (lab:upper pitch key)
  (let* ((n (modulo (+ 1 (ly:pitch-notename pitch)) 7))
         (a (assq n key)))
    (ly:make-pitch (+ (ly:pitch-octave pitch) (if (= n 0) 1 0)) n
                   (if a (cdr a) 0))))
% Save explicit pitchedTrill pitches before articulate removes the span event.
% Key and span state are separate in simultaneous voices/staves.
#(define (lab:prepare-trills music)
  (define (walk m state)
    (let ((name (ly:music-property m 'name))
          (elements (ly:music-property m 'elements))
          (element (ly:music-property m 'element)))
      (cond
        ((eq? name 'KeyChangeEvent)
         (vector-set! state 0 (ly:music-property m 'pitch-alist)))
        ((eq? name 'GraceMusic)
         (let ((last-pitch #f))
           (music-map (lambda (e)
             (if (eq? (ly:music-property e 'name) 'NoteEvent)
               (set! last-pitch (ly:music-property e 'pitch))) e) m)
           (vector-set! state 3 last-pitch)))
        ((eq? name 'EventChord)
         (for-each (lambda (e)
           (if (eq? (ly:music-property e 'name) 'TrillSpanEvent)
             (if (= (ly:music-property e 'span-direction) -1)
               (begin (vector-set! state 1 #t)
                      (vector-set! state 2 (ly:music-property e 'pitch #f)))
               (begin (vector-set! state 1 #f) (vector-set! state 2 #f))))) elements)
         (let ((notes (lab:notes m)))
           (if (pair? notes)
             (let* ((top (lab:highest notes))
                    (pitch (ly:music-property top 'pitch))
                    (explicit (vector-ref state 2))
                    (upper (if (ly:pitch? explicit) explicit
                               (lab:upper pitch (vector-ref state 0))))
                    (grace (vector-ref state 3))
                    (start (ly:music-property top 'lab-start-upper
                             (ly:music-property m 'lab-start-upper
                               (and (ly:pitch? grace) (equal? grace pitch))))))
               (ly:music-set-property! m 'lab-trill-upper upper)
               (ly:music-set-property! m 'lab-trill-start-upper start)
               (vector-set! state 3 #f)))))
        ((eq? name 'SimultaneousMusic)
         (for-each (lambda (e) (walk e (vector-copy state))) elements))
        (else
         (if (ly:music? element) (walk element state))
         (for-each (lambda (e) (walk e state)) elements)))))
  (event-chord-wrap! music)
  (walk music (vector '() #f #f #f))
  music)
labTrillSetup = #(define-music-function (music) (ly:music?)
  (lab:prepare-trills (ly:music-deep-copy music)))
% Tempo-sensitive target, 4-10 attacks/sec. This is an app interpretation,
% not a universal performance rule. Longer trills ease in and settle on the main note.
#(define (lab:trill-rate)
  (min 10 (max 4 (/ (* ac:currentTempo 4) 15))))
#(define (lab:trill music)
  (let* ((notes (lab:notes music))
         (length (ly:moment-main (ly:music-length music))))
    (if (or (null? notes) (<= length 0)) music
      (let* ((top (lab:highest notes))
             (main (ly:music-property top 'pitch))
             (upper (ly:music-property music 'lab-trill-upper
                      (lab:upper main (ly:music-property ac:current-key 'pitch-alist))))
             (start-upper (ly:music-property music 'lab-trill-start-upper #f))
             (seconds (* 60 (/ length ac:currentTempo)))
             (raw (max 3 (inexact->exact (round (* seconds (lab:trill-rate))))))
             ;; Even upper-start / odd main-start counts both end on the main note.
             (count (+ raw (if (eq? (even? raw) start-upper) 0 1)))
             (weights (map (lambda (i)
               (cond ((and (>= seconds 1) (= i 0)) 7/4)
                     ((and (>= seconds 1) (= i 1)) 3/2)
                     ((and (>= seconds 1) (= i 2)) 5/4)
                     ((= i (- count 1)) 3/2)
                     (else 1))) (iota count)))
             (total (apply + weights))
             (events (filter (lambda (e) (not (eq? (ly:music-property e 'name) 'NoteEvent)))
                              (ly:music-property music 'elements)))
             (steps (map (lambda (i w)
               (let ((note (ly:music-deep-copy top)))
                 (ly:music-set-property! note 'articulations '())
                 (ly:music-set-property! note 'pitch
                   (if (eq? (even? i) start-upper) upper main))
                 (ly:music-set-property! note 'duration
                   (ly:make-duration 0 0 (* length (/ w total))))
                 (make-music 'EventChord 'elements
                   (cons note (if (= i 0) events '()))))) (iota count) weights))
             (trill (make-sequential-music steps))
             (held (filter (lambda (n) (not (eq? n top))) notes)))
        (if (null? held) trill
          (make-music 'SimultaneousMusic 'elements
            (list trill (make-music 'EventChord 'elements held))))))))
#(set! ac:trill lab:trill)
% Reserve a moderate two-note closing turn when afterGrace explicitly supplies it.
% No unnotated cadence or extra notes are invented.
#(define lab:originalTwiddletime ac:twiddletime)
#(set! ac:twiddletime (lambda (music)
  (if (any (lambda (e) (and (eq? (ly:music-property e 'name) 'ArticulationEvent)
                           (eq? (ly:music-property e 'articulation-type) 'trill)))
           (ly:music-property music 'elements))
    (min (/ (ly:moment-main (ly:music-length music)) 3)
         (/ (* ac:currentTempo 2) (* 60 (lab:trill-rate))))
    (lab:originalTwiddletime music))))
`;
