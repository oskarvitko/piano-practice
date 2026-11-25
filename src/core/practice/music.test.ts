import { describe, expect, it } from 'vitest';
import { MAJOR, pitchClass } from '../music';
import {
  buildChord,
  CHORDS,
  CHORD_BY_ID,
  chordToneName,
  parseChord,
  supportsVoicing,
  voiceChord,
  voicingDistance,
} from './chords';
import { defaultConfig, FILLS, VOICINGS } from './config';
import { scalePlan, transitionExample } from './examples';
import { PROGRESSIONS } from '../../data/practice/progressions';
import { PATTERNS } from '../../programs/scales-and-runs';
import { transposeExample } from '../music/examples';

describe('Practice music theory', () => {
  it('builds every chord formula in all 12 centres with valid spellings and retained intervals', () => {
    expect(CHORDS).toHaveLength(36);
    for (let pc = 0; pc < 12; pc++)
      for (const definition of CHORDS) {
        const chord = buildChord(
          { pc, mode: 'major' },
          { degree: 1, accidental: 0, type: definition.id },
        );
        expect(chord.names.length).toBe(definition.intervals.length);
        const notes = voiceChord(chord, 'root');
        for (const kind of Object.keys(VOICINGS) as (keyof typeof VOICINGS)[])
          if (supportsVoicing(chord.type, kind)) {
            const v = voiceChord(chord, kind);
            expect(
              Math.max(...v.leftHand) - Math.min(...v.leftHand),
              `${definition.id} ${kind} LH`,
            ).toBeLessThanOrEqual(12);
            expect(
              Math.max(...v.rightHand) - Math.min(...v.rightHand),
              `${definition.id} ${kind} RH`,
            ).toBeLessThanOrEqual(12);
          }
        expect([...notes.leftHand, ...notes.rightHand].every((n) => n >= 21 && n <= 108)).toBe(
          true,
        );
        for (const interval of definition.intervals)
          expect(
            [...notes.leftHand, ...notes.rightHand].map((n) => pitchClass(n - chord.root)),
          ).toContain(pitchClass(interval));
      }
    expect(buildChord({ pc: 6, mode: 'major' }, parseChord('I')).names).toEqual(['F#', 'A#', 'C#']);
    expect(buildChord({ pc: 5, mode: 'major' }, parseChord('IV')).names).toEqual(['Bb', 'D', 'F']);
    expect(buildChord({ pc: 1, mode: 'minor' }, parseChord('i')).names).toEqual(['Db', 'Fb', 'Ab']);
    expect(buildChord({ pc: 0, mode: 'major' }, parseChord('viidim7')).names).toEqual([
      'B',
      'D',
      'F',
      'Ab',
    ]);
    expect(CHORD_BY_ID.add2.intervals).toEqual([0, 2, 4, 7]);
    expect(CHORD_BY_ID.add9.intervals).toEqual([0, 4, 7, 14]);
  });
  it('resolves natural and harmonic minor and explicit slash bass independently of chord quality', () => {
    const minor = { pc: 9, mode: 'minor' as const };
    expect(buildChord(minor, parseChord('i')).symbol).toBe('Am');
    expect(buildChord(minor, parseChord('V7')).symbol).toBe('E7');
    expect(buildChord(minor, parseChord('V7')).names).toContain('G#');
    expect(buildChord(minor, parseChord('bVI')).degreeLabel).toBe('6');
    const slash = buildChord({ pc: 7, mode: 'major' }, parseChord('V/7'));
    expect(slash.symbol).toBe('D/F#');
    expect(pitchClass(slash.bass)).toBe(6);
    const tonic = buildChord({ pc: 7, mode: 'major' }, parseChord('I'));
    const example = transitionExample(
      { pc: 7, mode: 'major' },
      slash,
      tonic,
      voiceChord(slash),
      voiceChord(tonic),
      80,
      'target',
    );
    expect(transposeExample(example, 60).progression[0].name).toBe('G/B');
    const chord = buildChord({ pc: 0, mode: 'major' }, parseChord('Imaj7'));
    for (const [kind, bass] of [
      ['root', 0],
      ['first', 4],
      ['second', 7],
      ['third', 11],
    ] as const)
      expect(pitchClass(voiceChord(chord, kind).leftHand[0])).toBe(bass);
  });
  it('offers playable voicings, removes requested degrees and preserves chord spelling', () => {
    const c = buildChord({ pc: 0, mode: 'major' }, parseChord('Imaj9'));
    const g = buildChord({ pc: 0, mode: 'major' }, parseChord('V7'));
    for (const kind of Object.keys(VOICINGS) as (keyof typeof VOICINGS)[])
      if (supportsVoicing(c.type, kind)) {
        const v = voiceChord(c, kind);
        expect(v.rightHand.length).toBeGreaterThan(0);
        expect(v.rightHand.at(-1)! - v.rightHand[0]).toBeLessThanOrEqual(19);
      }
    expect(voiceChord(c, 'no3').rightHand.map(pitchClass)).not.toContain(4);
    expect(voiceChord(c, 'no5').rightHand.map(pitchClass)).not.toContain(7);
    expect(voiceChord(c, 'rootless').rightHand.map(pitchClass)).not.toContain(0);
    expect(voiceChord(c, 'shell').rightHand.map(pitchClass)).toEqual([4, 11]);
    const prior = voiceChord(c, 'close').rightHand;
    expect(voicingDistance(prior, voiceChord(g, 'smooth', prior).rightHand)).toBeLessThanOrEqual(
      voicingDistance(prior, voiceChord(g, 'root').rightHand),
    );
    expect(chordToneName(buildChord({ pc: 6, mode: 'major' }, parseChord('Imaj7')), 65, true)).toBe(
      'E#4',
    );
    expect(() =>
      voiceChord(buildChord({ pc: 0, mode: 'major' }, parseChord('I')), 'third'),
    ).toThrow();
  });
  it('authors 95 unique progressions with style quotas, minor contexts, valid types and honest levels', () => {
    expect(PROGRESSIONS).toHaveLength(95);
    expect(new Set(PROGRESSIONS.map((p) => p.id)).size).toBe(95);
    expect(new Set(PROGRESSIONS.map((p) => p.chords.join(' '))).size).toBe(95);
    for (const [style, count] of Object.entries({
      worship: 25,
      gospel: 20,
      jazz: 20,
      pop: 20,
      blues: 10,
    })) {
      const list = PROGRESSIONS.filter((p) => p.style === style);
      expect(list).toHaveLength(count);
      expect(new Set(list.map((p) => p.mode)).size).toBe(2);
    }
    for (const p of PROGRESSIONS) {
      if (p.style === 'blues') expect(p.chords).toHaveLength(12);
      for (const token of p.chords) {
        const c = parseChord(token);
        expect(CHORD_BY_ID[c.type].level, `${p.id}: ${token}`).toBeLessThanOrEqual(p.difficulty);
        for (let pc = 0; pc < 12; pc++)
          expect(buildChord({ pc, mode: p.mode }, c).root).toBe(
            60 + pc + MAJOR[c.degree - 1] + c.accidental,
          );
      }
    }
  });
  it('generates two harmonically distinct, fully resolved examples for every fill in major and minor', () => {
    for (const mode of ['major', 'minor'] as const)
      for (let pc = 0; pc < 12; pc++)
        for (const kind of Object.keys(FILLS) as (keyof typeof FILLS)[]) {
          const key = { pc, mode };
          const chords = (mode === 'major' ? ['I', 'IV', 'V'] : ['i', 'iv', 'V7']).map((c) =>
            buildChord(key, parseChord(c)),
          );
          const examples = [0, 1].map((i) =>
            transitionExample(
              key,
              chords[i],
              chords[i + 1],
              voiceChord(chords[i]),
              voiceChord(chords[i + 1]),
              80,
              kind,
              i,
            ),
          );
          expect(examples[0].progression.map((c) => c.name)).not.toEqual(
            examples[1].progression.map((c) => c.name),
          );
          for (const ex of examples) {
            const target = ex.targetNotes[0];
            expect(target.beat).toBe(4);
            expect(
              ex.events.some(
                (e) => e.startBeat === 4 && e.hand === 'right' && e.notes.includes(target.note),
              ),
            ).toBe(true);
            expect(ex.progression[1].notes.map(pitchClass)).toContain(pitchClass(target.note));
            expect(
              ex.events.every(
                (e) => e.startBeat >= 0 && e.startBeat + e.durationBeats <= ex.lengthBeats,
              ),
            ).toBe(true);
          }
        }
  });
  it('reuses Learning patterns, respects octave/direction/repetitions and both hands', () => {
    const config = {
      ...defaultConfig('scale'),
      octaves: 2 as const,
      repetitions: 3,
      hands: 'both' as const,
      direction: 'up' as const,
    };
    const plan = scalePlan({ pc: 0, mode: 'major' }, config, PATTERNS);
    expect(plan.events).toHaveLength(15 * 3 * 2);
    expect(plan.events[0].notes).toEqual([60]);
    expect(plan.events[1].notes).toEqual([36]);
    expect(plan.events[28].notes).toEqual([84]);
    const minor = scalePlan(
      { pc: 9, mode: 'minor' },
      { ...config, scale: 'harmonic-minor', hands: 'right', repetitions: 1, octaves: 1 },
      PATTERNS,
    );
    expect(minor.events.map((e) => e.notes[0])).toContain(80);
    const p5 = scalePlan(
      { pc: 0, mode: 'major' },
      { ...config, pattern: 'P5', hands: 'right', repetitions: 1, octaves: 1 },
      PATTERNS,
    );
    expect(p5.events.slice(-2).map((e) => e.notes[0])).toEqual([65, 72]);
    for (const subdivision of [1, 2, 3, 4] as const) {
      const compound = scalePlan(
        { pc: 0, mode: 'major' },
        { ...config, meter: '6/8', subdivision, hands: 'right' },
        PATTERNS,
      );
      expect(compound.events[0].durationBeats).toBeCloseTo(2 / 3 / subdivision);
      expect(
        compound.events.every((e) => Math.abs(e.beat * 18 - Math.round(e.beat * 18)) < 1e-6),
      ).toBe(true);
    }
  });
});
