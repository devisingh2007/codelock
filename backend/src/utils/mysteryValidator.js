"use strict";

/**
 * @module mysteryValidator
 * Validates the JSON structure returned by the AI mystery generator.
 *
 * The expected shape is:
 * {
 *   title: string,
 *   location: string,
 *   victim: { name: string, description: string },
 *   crime:  { type: string, weapon: string, summary: string, killer?: string },
 *   suspects: [
 *     { name: string, background: string, relationshipToVictim: string,
 *       isMurderer: boolean }   // exactly ONE must be true
 *   ],
 *   timeline: [{ time: string, event: string }]   // at least 1 entry
 * }
 */

/**
 * Validates an AI-generated mystery object.
 *
 * @param {object} mystery          – Parsed AI output.
 * @param {number} [minSuspects=2]  – Minimum number of suspects required.
 * @returns {string[]} Array of human-readable error messages; empty = valid.
 */
const validateMystery = (mystery, minSuspects = 2) => {
  const errors = [];

  if (!mystery || typeof mystery !== "object") {
    return ["Output is not a JSON object."];
  }

  // ── Top-level string fields ──────────────────────────────────────────────
  for (const field of ["title", "location"]) {
    if (!mystery[field] || typeof mystery[field] !== "string" || mystery[field].trim() === "") {
      errors.push(`Missing or empty required field: "${field}".`);
    }
  }

  // ── victim ───────────────────────────────────────────────────────────────
  if (!mystery.victim || typeof mystery.victim !== "object") {
    errors.push('Missing required field: "victim" (must be an object).');
  } else {
    for (const f of ["name", "description"]) {
      if (!mystery.victim[f] || typeof mystery.victim[f] !== "string" || mystery.victim[f].trim() === "") {
        errors.push(`Missing or empty required field: "victim.${f}".`);
      }
    }
  }

  // ── crime ────────────────────────────────────────────────────────────────
  if (!mystery.crime || typeof mystery.crime !== "object") {
    errors.push('Missing required field: "crime" (must be an object).');
  } else {
    for (const f of ["type", "weapon", "summary"]) {
      if (!mystery.crime[f] || typeof mystery.crime[f] !== "string" || mystery.crime[f].trim() === "") {
        errors.push(`Missing or empty required field: "crime.${f}".`);
      }
    }
  }

  // ── suspects ─────────────────────────────────────────────────────────────
  if (!Array.isArray(mystery.suspects)) {
    errors.push('"suspects" must be an array.');
  } else {
    if (mystery.suspects.length < minSuspects) {
      errors.push(
        `"suspects" must have at least ${minSuspects} entries (got ${mystery.suspects.length}).`
      );
    }

    mystery.suspects.forEach((suspect, i) => {
      if (!suspect || typeof suspect !== "object") {
        errors.push(`suspects[${i}] is not an object.`);
        return;
      }
      for (const f of ["name", "background", "relationshipToVictim"]) {
        if (!suspect[f] || typeof suspect[f] !== "string" || suspect[f].trim() === "") {
          errors.push(`Missing or empty required field: suspects[${i}].${f}.`);
        }
      }
      if (typeof suspect.isMurderer !== "boolean") {
        errors.push(`suspects[${i}].isMurderer must be a boolean.`);
      }
    });

    // Exactly one murderer must be flagged
    const murderers = mystery.suspects.filter((s) => s.isMurderer === true);

    // Also accept crime.killer as the authority if isMurderer not set
    if (murderers.length === 0) {
      const killer = mystery.crime?.killer;
      if (killer) {
        const match = mystery.suspects.find(
          (s) => s.name?.toLowerCase() === killer.toLowerCase()
        );
        if (!match) {
          errors.push(
            `crime.killer "${killer}" does not match any suspect name.`
          );
        }
        // Tolerate this – validator accepts crime.killer as the marker
      } else {
        errors.push('Exactly one suspect must have isMurderer=true (or crime.killer set).');
      }
    } else if (murderers.length > 1) {
      errors.push(
        `Exactly one suspect must have isMurderer=true (found ${murderers.length}).`
      );
    }
  }

  // ── timeline ─────────────────────────────────────────────────────────────
  if (!Array.isArray(mystery.timeline) || mystery.timeline.length === 0) {
    errors.push('"timeline" must be a non-empty array.');
  } else {
    mystery.timeline.forEach((entry, i) => {
      for (const f of ["time", "event"]) {
        if (!entry[f] || typeof entry[f] !== "string" || entry[f].trim() === "") {
          errors.push(`Missing or empty field: timeline[${i}].${f}.`);
        }
      }
    });
  }

  return errors;
};

module.exports = { validateMystery };
