"use strict";

/**
 * @file tests/utils/mysteryValidator.test.js
 * Comprehensive unit tests for mysteryValidator.
 *
 * Covers every validation branch:
 *  - Non-object input
 *  - Missing / empty top-level string fields (title, location)
 *  - Missing or malformed victim / crime objects and their sub-fields
 *  - Suspects count, per-suspect required fields, isMurderer flag
 *  - Exactly one murderer (none → error, more than one → error)
 *  - crime.killer as fallback authority when isMurderer not present
 *  - Timeline length and per-entry field validation
 *  - Happy path: fully valid mystery returns no errors
 */

const { validateMystery } = require("../../src/utils/mysteryValidator");

// ── Fixture: fully valid mystery with 3 suspects ─────────────────────────────
const BASE_MYSTERY = {
  title: "Shadows at Blackmoor",
  location: "Blackmoor Castle, Scotland",
  victim: {
    name: "Lord Reginald Voss",
    description: "Eccentric aristocrat who inherited a vast fortune.",
  },
  crime: {
    type: "poisoning",
    weapon: "Strychnine in the evening tea",
    summary:
      "Lord Voss was poisoned during the annual dinner party. The poison acted slowly, causing him to collapse after the toast.",
    killer: "Dr. Evelyn Cross",
  },
  suspects: [
    {
      name: "Dr. Evelyn Cross",
      background: "Physician with access to medicines and a secret motive.",
      relationshipToVictim: "Personal physician",
      isMurderer: true,
    },
    {
      name: "Arthur Voss",
      background: "Estranged son, cut from the will.",
      relationshipToVictim: "Son",
      isMurderer: false,
    },
    {
      name: "Miriam Finch",
      background: "Loyal housekeeper who discovered irregularities.",
      relationshipToVictim: "Housekeeper",
      isMurderer: false,
    },
  ],
  timeline: [
    { time: "19:00", event: "Guests arrive at the castle." },
    { time: "20:30", event: "Dinner is served." },
    { time: "22:00", event: "Toast is made; Lord Voss drinks." },
    { time: "23:45", event: "Lord Voss collapses; Dr. Cross declares him dead." },
  ],
};

// ── Helper: deep clone to avoid mutation between tests ────────────────────────
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – happy path", () => {
  test("returns an empty array for a fully valid mystery", () => {
    const errors = validateMystery(BASE_MYSTERY, 3);
    expect(errors).toHaveLength(0);
  });

  test("returns empty errors when minSuspects equals exact suspects count", () => {
    const m = clone(BASE_MYSTERY);
    expect(validateMystery(m, 3)).toHaveLength(0);
  });

  test("returns empty errors with default minSuspects=2", () => {
    const m = clone(BASE_MYSTERY);
    expect(validateMystery(m)).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – non-object input", () => {
  test("returns error for null input", () => {
    const errors = validateMystery(null);
    expect(errors).toContain("Output is not a JSON object.");
  });

  test("returns error for undefined input", () => {
    const errors = validateMystery(undefined);
    expect(errors).toContain("Output is not a JSON object.");
  });

  test("returns error for string input", () => {
    const errors = validateMystery("not an object");
    expect(errors).toContain("Output is not a JSON object.");
  });

  test("returns error for array input", () => {
    // Arrays pass typeof === 'object' checks; validator processes them as objects
    // and returns field-level errors (no title, location, etc.) rather than the
    // generic "not a JSON object" message. Verify errors are reported.
    const errors = validateMystery([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – top-level string fields", () => {
  test("errors on missing title", () => {
    const m = clone(BASE_MYSTERY);
    delete m.title;
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "title".');
  });

  test("errors on empty string title", () => {
    const m = clone(BASE_MYSTERY);
    m.title = "";
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "title".');
  });

  test("errors on whitespace-only title", () => {
    const m = clone(BASE_MYSTERY);
    m.title = "   ";
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "title".');
  });

  test("errors on missing location", () => {
    const m = clone(BASE_MYSTERY);
    delete m.location;
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "location".');
  });

  test("errors on empty location", () => {
    const m = clone(BASE_MYSTERY);
    m.location = "";
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "location".');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – victim", () => {
  test("errors when victim is null", () => {
    const m = clone(BASE_MYSTERY);
    m.victim = null;
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("victim"))).toBe(true);
  });

  test("errors when victim is not an object", () => {
    const m = clone(BASE_MYSTERY);
    m.victim = "Lord Someone";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("victim"))).toBe(true);
  });

  test("errors when victim.name is empty", () => {
    const m = clone(BASE_MYSTERY);
    m.victim.name = "";
    expect(validateMystery(m, 3)).toContain('Missing or empty required field: "victim.name".');
  });

  test("errors when victim.description is missing", () => {
    const m = clone(BASE_MYSTERY);
    delete m.victim.description;
    expect(validateMystery(m, 3)).toContain(
      'Missing or empty required field: "victim.description".'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – crime", () => {
  test("errors when crime is null", () => {
    const m = clone(BASE_MYSTERY);
    m.crime = null;
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("crime"))).toBe(true);
  });

  test("errors when crime.type is empty", () => {
    const m = clone(BASE_MYSTERY);
    m.crime.type = "";
    expect(validateMystery(m, 3)).toContain(
      'Missing or empty required field: "crime.type".'
    );
  });

  test("errors when crime.weapon is empty", () => {
    const m = clone(BASE_MYSTERY);
    m.crime.weapon = "";
    expect(validateMystery(m, 3)).toContain(
      'Missing or empty required field: "crime.weapon".'
    );
  });

  test("errors when crime.summary is missing", () => {
    const m = clone(BASE_MYSTERY);
    delete m.crime.summary;
    expect(validateMystery(m, 3)).toContain(
      'Missing or empty required field: "crime.summary".'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – suspects", () => {
  test("errors when suspects is not an array", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects = "Dr. Cross";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("suspects"))).toBe(true);
  });

  test("errors when suspects count is below minSuspects", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects = [m.suspects[0]]; // only 1 suspect
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("at least 3"))).toBe(true);
  });

  test("errors when a suspect is missing 'name'", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects[1].name = "";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("suspects[1].name"))).toBe(true);
  });

  test("errors when a suspect is missing 'background'", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects[2].background = "";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("suspects[2].background"))).toBe(true);
  });

  test("errors when a suspect is missing 'relationshipToVictim'", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects[0].relationshipToVictim = "";
    const errors = validateMystery(m, 3);
    expect(
      errors.some((e) => e.includes("suspects[0].relationshipToVictim"))
    ).toBe(true);
  });

  test("errors when isMurderer is not a boolean", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects[0].isMurderer = "yes"; // string instead of boolean
    const errors = validateMystery(m, 3);
    expect(
      errors.some((e) => e.includes("isMurderer must be a boolean"))
    ).toBe(true);
  });

  // ── Murderer marker ──────────────────────────────────────────────────────────
  test("errors when no suspect has isMurderer=true and crime.killer is empty", () => {
    const m = clone(BASE_MYSTERY);
    m.crime.killer = "";
    m.suspects = m.suspects.map((s) => ({ ...s, isMurderer: false }));
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("isMurderer=true"))).toBe(true);
  });

  test("errors when more than one suspect has isMurderer=true", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects = m.suspects.map((s) => ({ ...s, isMurderer: true }));
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("Exactly one suspect"))).toBe(true);
  });

  test("accepts when crime.killer matches a suspect name (no isMurderer flag)", () => {
    const m = clone(BASE_MYSTERY);
    // Remove isMurderer from all suspects → validator falls back to crime.killer
    m.suspects = m.suspects.map(({ isMurderer: _, ...rest }) => rest);
    const errors = validateMystery(m, 3);
    // There will be type errors for missing isMurderer boolean,
    // but should NOT have a "no murderer" error since crime.killer is set
    expect(errors.some((e) => e.includes("Exactly one suspect must have isMurderer=true"))).toBe(false);
  });

  test("errors when crime.killer does not match any suspect name", () => {
    const m = clone(BASE_MYSTERY);
    m.suspects = m.suspects.map((s) => ({ ...s, isMurderer: false }));
    m.crime.killer = "Unknown Person";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("does not match any suspect name"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – timeline", () => {
  test("errors on missing timeline", () => {
    const m = clone(BASE_MYSTERY);
    delete m.timeline;
    const errors = validateMystery(m, 3);
    expect(errors).toContain('"timeline" must be a non-empty array.');
  });

  test("errors on empty timeline array", () => {
    const m = clone(BASE_MYSTERY);
    m.timeline = [];
    expect(validateMystery(m, 3)).toContain('"timeline" must be a non-empty array.');
  });

  test("errors when a timeline entry is missing 'time'", () => {
    const m = clone(BASE_MYSTERY);
    m.timeline[0].time = "";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("timeline[0].time"))).toBe(true);
  });

  test("errors when a timeline entry is missing 'event'", () => {
    const m = clone(BASE_MYSTERY);
    m.timeline[2].event = "";
    const errors = validateMystery(m, 3);
    expect(errors.some((e) => e.includes("timeline[2].event"))).toBe(true);
  });

  test("passes with exactly one timeline entry", () => {
    const m = clone(BASE_MYSTERY);
    m.timeline = [{ time: "23:00", event: "Murder occurred." }];
    const errors = validateMystery(m, 3);
    // timeline length is allowed to be 1; validator only requires non-empty
    expect(errors.some((e) => e.includes("timeline"))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("validateMystery – multiple simultaneous errors", () => {
  test("reports multiple errors at once", () => {
    const m = {
      title: "",
      location: "",
      victim: null,
      crime: null,
      suspects: [],
      timeline: [],
    };
    const errors = validateMystery(m, 2);
    expect(errors.length).toBeGreaterThan(4);
  });
});
