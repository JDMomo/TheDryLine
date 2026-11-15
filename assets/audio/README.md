# assets/audio: hand-off for Ableton Live

The game already plays a placeholder soundtrack made in code (`js/content/music.js`). This folder is where your real tracks go. Nothing here is needed for the game to run.

```
assets/audio/
  midi/            one MIDI file per track, written from the same patterns the game plays (do not edit; regenerate)
  <track>.ogg      a finished track, one full mix (optional)
  <track>__<layer>.ogg   a finished track as stems, one file per layer (optional)
```

## 1. Open the placeholders in Ableton

1. Regenerate if the patterns changed: `node tools/audio/export_midi.mjs` (writes `assets/audio/midi/*.mid` and `index.json`).
2. In Live, make a new empty Set. Drag one `.mid` file from the Browser (or from Finder) into the Arrangement or a Session slot. Live should offer to create one MIDI track per track in the file; the file sets the tempo and time signature (check that the Set's tempo and signature changed to the ones in the table below; Live's prompts differ between versions, and I could not run Live to check the wording).
3. Each MIDI track is named `<layer id> | <role> | <starting instrument>`. The part after the second bar is a suggestion in Live's built-in instruments and effects (see section 2); change it freely. The first track (conductor) carries markers: `loop start` at bar 1 and `loop end` after the last bar, the key, the mood, and the swing amount if the track swings.
4. Drum layers use General MIDI note numbers laid out for a Drum Rack: kick 36, rim 37, snare 38, clap 39, closed hat 42, open hat 46, tom 45, clock tick 76. Load a Drum Rack with a kit and move the pads, or map them yourself.
5. Octave warning: Live names MIDI note 60 "C3". The names in `docs/AUDIO_BIBLE.md` and in the data call it C4. The notes are the same; Live's label is one octave lower.
6. Swing: the swung tracks (r1) are written straight. Apply a Groove or move the off-beat eighths late by the amount in the marker text.
7. `boss_warden` is one track played in four keys. `boss_warden__variant_r1.mid` to `r4.mid` are the same notes transposed (+0, +2, -2, +5 semitones; drums unchanged). Make four finished tracks `boss_r1` to `boss_r4` (see the bible) or one track with the four transpositions.

| File | Track | BPM | Signature | Bars | Seconds | Key | Layers |
|---|---|---|---|---|---|---|---|
| title.mid | The Line Waits | 84 | 4/4 | 16 | 45.7 | D dorian | bed, bass, lead, arp, perc |
| hub.mid | The Junction | 96 | 3/4 | 16 | 30.0 | F lydian | bed, bass, lead, chords, fare, perc |
| r1.mid | Hulls and Chains | 108 | 4/4 swing | 16 | 35.6 | E aeolian | bed, bass, perc, lead, line, tense |
| r2.mid | Lamps in the Dusk | 132 | 7/8 | 16 | 25.5 | F# dorian | bed, bass, lead, perc, line, tense |
| r3.mid | White Canyon | 92 | 6/8 | 16 | 31.3 | A lydian | bed, bass, lead, arp, perc, line, tense |
| r4.mid | Stopped Clocks | 76 | 4/4 | 16 | 50.5 | C aeolian | bed, bass, keys, perc, lead, line, tense |
| final.mid | End of the Line | 100 | 5/4 | 16 | 48.0 | B aeolian | bed, bass, perc, lead, line, tense |
| quiet.mid | Waiting Room | 60 | 4/4 | 16 | 64.0 | G lydian | bed, bass, keys, lead, line |
| boss_warden.mid | Fare Slots | 150 | 4/4 | 16 | 25.6 | E aeolian | bed, bass, drums, rage, lead, slot_pierce, slot_arc, slot_burst, slot_ground, lift, lift2, tense |
| boss_clock.mid | The Count | 156 | 3/4 | 24 | 27.7 | B aeolian | bed, bass, drums, rage, lead, slot_*, borrow_r1 to r4, lift, tense |
| win.mid | Departure Cancelled | 96 | 4/4 | 8 | 20.0 | D major | bed, bass, lead, bell (plays once) |
| lose.mid | The Party Has Fallen | 56 | 4/4 | 4 | 17.1 | D aeolian | bed, bass, lead (plays once) |

## 2. Instruments per layer (a starting point)

Operator, Wavetable, Simpler and Drum Rack are the safe base set. Analog, Collision, Electric and Tension need Suite or Packs (check your edition; Operator or Wavetable can stand in).

| Layer type | Start with | Then |
|---|---|---|
| pad (`bed`, `lift`, `tense`) | Wavetable, Basic Shapes, two saws detuned about 12 cents, low-pass 12 dB near 1.2 kHz, attack 0.4 s, release 1.2 s | Chorus-Ensemble, Reverb 3 s, a little Erosion or Vinyl Distortion for cassette grit (Aphex), EQ Eight to roll off above 6 kHz |
| bass (`bass`, `slot_ground`) | Operator: sine plus saw, filter envelope with fast decay | Saturator (soft), Auto Filter low-pass |
| sub | Operator sine, attack 80 ms | nothing else |
| pulse lead (`lead` in title, boss, final) | Operator square wave at 25 percent (12.5 percent for the Terminus), light vibrato | Echo dotted eighth, 20 percent |
| bell (`lead` in hub, r2, r4, quiet, lose; `fare`, `borrow_*`, `lift2`) | Operator, two sines at ratio 3.5, fast decay on the modulator; or Collision | Reverb 2.5 s, Echo |
| pluck (`lead` in r1, `arp` in r3) | Collision (Marimba) or Operator square 12 percent, short decay | Echo, Reverb 1.5 s |
| arp (`arp`, `slot_pierce`) | Operator triangle, decay 150 ms | Echo dotted eighth |
| keys (`chords`, `keys`, `line` in r2) | Electric (Rhodes-like), or Operator sine plus triangle | Chorus-Ensemble, Vinyl Distortion light; in r4 add a slow pitch wobble from an Auto Filter LFO |
| drums (`perc`, `drums`, `rage`) | Drum Rack, 808 Core or Kit-Core 808, hats at low velocity | Glue Compressor, Saturator; for r4 and the Terminus use tick sounds for `m` |

Lead-in note for stems: keep the stem names as the layer ids above, so the engine finds them.

## 3. Export loops back to the game

For each track, once per layer you want in the game:

1. Set the Set's tempo and time signature to the table's values. Put the loop brace over exactly the bars in the table, starting at bar 1.
2. File, Export Audio/Video. Use "All Individual Tracks" to bounce every stem, or "Master" for a single mix. Turn on the render-as-loop option, so reverb and echo tails wrap into the start of the loop (the names of these options are from memory; look for them in your version).
3. Rendered length: the loop's exact bars. Sample rate 48 kHz, 16 or 24 bit WAV, normalise off, dither off. Master limiter off on the stems. The sum of all stems should peak at -3 dBFS or lower, and sit near -18 LUFS integrated.
4. Name files `<track>__<layer>.wav` for stems (`boss_warden__slot_pierce.wav`) or `<track>.wav` for a full mix. Use the track ids and layer ids from the table, exactly.
5. Convert to Ogg Vorbis, 48 kHz, quality 5: for example `ffmpeg -i title__bed.wav -c:a libvorbis -q:a 5 title__bed.ogg` (ffmpeg is not part of the repo). Put the `.ogg` files in this folder. Keep the `.wav` files out of the repository.
6. Tell the game they exist: in `js/content/music.js`, `G.music.files`: `title: true` (one full mix), or `boss_warden: { stems: ['bed', 'bass', 'drums', 'lead', 'slot_pierce', 'slot_arc', 'slot_burst', 'slot_ground', 'rage'] }` (only the layers you export; the other layers stay silent for that track).
7. Open the game over http (not `file://`; browsers block file loading there): for example `python3 -m http.server` in the game folder, then `http://localhost:8000`. Press a key; the title track should be the file. Press M to mute, use Comfort in the pause menu for the sliders.

Loop rules the engine relies on: every stem has exactly the same length to the sample; the loop covers the whole file (loop start at 0); the length equals bars times beats times 60 / bpm seconds. If a loop clicks or drifts against its stems, the length is wrong by a few milliseconds: re-export with the exact bar count, and keep the render-as-loop option on. A track that has no file, a file that will not decode, or a file that has not finished loading keeps playing the synth version, so a half-finished folder never breaks the game.

Stings (`win`, `lose`) are not loops: export the whole bars plus about 3 seconds of tail; the engine plays them once.

Memory: a decoded stereo 48 kHz stem costs about 0.4 MB per second; keep a track under about 40 MB decoded (a 40-second loop of eight stereo stems is already over). Use mono for bass, sub and drums, and merge stems that never move on their own.

## 4. Check your work

`node tools/smoke.mjs audio` checks the patterns, the MIDI files, the engine under a stub, and a render of every placeholder. It does not play your files: open the game and listen, at the title, the Junction, one room of each region, a Warden fight (punch a slot and hear its stem fade), and the Long Clock with and without Wardens beaten.
