/**
 * @module roleValidator
 * Validator helper functions for Phase 7 AI Character & Role Assignment.
 */

"use strict";

/**
 * Validates a list of assigned roles.
 *
 * @param {Array} roles - Array of role objects.
 * @param {number} playersCount - Number of connected players in the game.
 * @returns {string[]} Array of detailed validation error messages. (Empty array means valid).
 */
const validateRoles = (roles, playersCount) => {
  const errors = [];

  if (!Array.isArray(roles)) {
    return ["Roles must be an array."];
  }

  // 1. Check duplicate roleName
  const roleNames = roles.map((r) => r.roleName);
  const uniqueNames = new Set(roleNames);
  if (roleNames.length !== uniqueNames.size) {
    errors.push("Duplicate role names are not allowed.");
  }

  // 2. Count roles with non-null userId
  const playerRoles = roles.filter((r) => r.userId !== null && r.userId !== undefined);
  if (playerRoles.length !== playersCount) {
    errors.push(
      `Expected exactly ${playersCount} roles to be assigned to players (userId non-null), but got ${playerRoles.length}.`
    );
  }

  // 3. Check role details
  roles.forEach((role, index) => {
    const prefix = `Role[${index}] (${role.roleName || "unnamed"}):`;

    if (!role.roleName || typeof role.roleName !== "string" || role.roleName.trim() === "") {
      errors.push(`${prefix} roleName must be a non-empty string.`);
    } else if (role.roleName.length > 300) {
      errors.push(`${prefix} roleName exceeds 300 characters.`);
    }

    if (!role.background || typeof role.background !== "string" || role.background.trim() === "") {
      errors.push(`${prefix} background must be a non-empty string.`);
    } else if (role.background.length > 300) {
      errors.push(`${prefix} background exceeds 300 characters.`);
    }

    if (!role.objective || typeof role.objective !== "string" || role.objective.trim() === "") {
      errors.push(`${prefix} objective must be a non-empty string.`);
    } else if (role.objective.length > 300) {
      errors.push(`${prefix} objective exceeds 300 characters.`);
    }

    if (!role.secret || typeof role.secret !== "string" || role.secret.trim() === "") {
      errors.push(`${prefix} secret must be a non-empty string.`);
    } else if (role.secret.length > 300) {
      errors.push(`${prefix} secret exceeds 300 characters.`);
    }
  });

  return errors;
};

module.exports = {
  validateRoles,
};
