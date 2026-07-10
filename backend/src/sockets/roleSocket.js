/**
 * @module roleSocket
 * Phase 7 Socket.IO handlers for AI Character & Role Assignment.
 */

"use strict";

const roleService = require("../services/roleService");

/**
 * Registers Phase 7 role assignment socket events.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance.
 */
const roleSocket = (io) => {
  if (!io) {
    console.warn("[RoleSocket] io instance is null – skipping setup.");
    return;
  }

  io.on("connection", (socket) => {
    const user = socket.user;

    if (!user) {
      return;
    }

    // Host request to assign roles
    socket.on("request-role-assignment", async ({ roomId } = {}, callback) => {
      try {
        if (!roomId) {
          return callback?.({ error: "roomId is required." });
        }

        const code = roomId.toUpperCase();

        // 1. Assign roles in database atomically
        const updatedState = await roleService.assignRoles(code, user._id.toString());

        // 2. Broadcast the phase change and sync-state to all players in the room
        io.to(code).emit("phase-advanced", { state: updatedState });
        io.to(code).emit("state-changed", { state: updatedState });

        // 3. Find and deliver private roles to active players
        const roles = updatedState.roles || [];
        const connectedSockets = await io.fetchSockets();

        for (const role of roles) {
          if (!role.userId) {
            // NPC role - no private socket delivery needed
            continue;
          }

          const targetUserId = role.userId.toString();
          const targetSocket = connectedSockets.find(
            (s) => s.user && s.user._id.toString() === targetUserId
          );

          if (targetSocket) {
            const socketId = targetSocket.id;
            console.log(
              `[RoleSocket] Delivering role data privately to user ${targetUserId} on socket ${socketId}`
            );

            // Attempt delivery
            let delivered = false;
            try {
              // Direct emit on targetSocket to avoid sender-exclusion in socket.to
              targetSocket.emit("role-assigned", { role });
              delivered = true;
            } catch (err) {
              console.warn(
                `[RoleSocket] Delivery failed for user ${targetUserId}. Retrying once...`,
                err
              );
              // Retry once
              try {
                targetSocket.emit("role-assigned", { role });
                delivered = true;
              } catch (retryErr) {
                console.error(
                  `[RoleSocket] Retry failed for user ${targetUserId}:`,
                  retryErr
                );
              }
            }

            if (delivered) {
              console.log(`[RoleSocket] Delivered role to user ${targetUserId} successfully.`);
            }
          } else {
            console.error(
              `[RoleSocket] Player ${targetUserId} is disconnected. Socket not found.`
            );
          }
        }

        // Return successful status to host
        callback?.({ success: true, state: updatedState });
      } catch (err) {
        console.error("[RoleSocket] request-role-assignment error:", err);
        const code = err.statusCode || 500;
        callback?.({ error: err.message, code });
      }
    });
  });
};

module.exports = roleSocket;
