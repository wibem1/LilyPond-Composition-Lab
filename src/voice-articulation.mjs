// articulate.ly keeps timing, slur, key and tempo state in global Scheme variables.
// Its ordinary music-map visits all simultaneous parts as one sequential stream.
// Scope that state to each parallel branch in the app's MIDI-only score.
export const voiceArticulationPrelude=String.raw`
% A leading grace group borrows forward within its own voice. The stock
% function warns here even though this is a valid, expected beginning.
#(define lab:original-steal-backward ac:stealTimeBackward)
#(set! ac:stealTimeBackward (lambda (amount)
  (if (null? ac:eventsBackward)
    (set! ac:stealForward (+ ac:stealForward amount))
    (lab:original-steal-backward amount))))
#(define (lab:articulation-state)
  (vector ac:inSlur ac:inPhrasingSlur ac:inTrill ac:current-key
          ac:currentTempo ac:lastTempo ac:currentDuration
          ac:stealForward ac:eventsBackward))
#(define (lab:restore-articulation-state state)
  (set! ac:inSlur (vector-ref state 0))
  (set! ac:inPhrasingSlur (vector-ref state 1))
  (set! ac:inTrill (vector-ref state 2))
  (set! ac:current-key (vector-ref state 3))
  (set! ac:currentTempo (vector-ref state 4))
  (set! ac:lastTempo (vector-ref state 5))
  (set! ac:currentDuration (vector-ref state 6))
  (set! ac:stealForward (vector-ref state 7))
  (set! ac:eventsBackward (vector-ref state 8)))
#(define (lab:articulate-voices music)
  (define (walk m)
    (let ((elements (ly:music-property m 'elements))
          (element (ly:music-property m 'element)))
      (if (eq? (ly:music-property m 'name) 'SimultaneousMusic)
        (let ((state (lab:articulation-state)))
          (dynamic-wind
            (lambda () #t)
            (lambda ()
              (ly:music-set-property! m 'elements
                (map (lambda (child)
                  (lab:restore-articulation-state state)
                  (set! ac:stealForward 0)
                  (set! ac:eventsBackward '())
                  (walk child)) elements)))
            (lambda () (lab:restore-articulation-state state))))
        (ly:music-set-property! m 'elements (map walk elements)))
      (ly:music-set-property! m 'articulations
        (map walk (ly:music-property m 'articulations)))
      (if (ly:music? element) (ly:music-set-property! m 'element (walk element)))
      ;; Match music-map's single-node length refresh without traversing
      ;; the already processed descendants a second time.
      (let* ((result (ac:articulate-chord m))
             (callback (ly:music-property result 'length-callback))
             (cached (ly:music-property result 'length)))
        (if (and (procedure? callback) (ly:moment? cached))
          (ly:music-set-property! result 'length (callback result)))
        result)))
  (let ((state (lab:articulation-state)))
    (dynamic-wind
      (lambda ()
        (set! ac:stealForward 0)
        (set! ac:eventsBackward '()))
      (lambda () (walk (ac:startup-replacements (ly:music-deep-copy music))))
      (lambda () (lab:restore-articulation-state state)))))
labArticulateVoices = #(define-music-function (music) (ly:music?)
  (lab:articulate-voices music))
`;
