import { describe, it, expect } from 'vitest';

// Test the mock data shapes — verifies contract between frontend and mocks
import {
  mockPlayers,
  mockObjectives,
  mockEvidenceLog,
  mockTimeline,
  mockRevealData,
} from '../mocks/mockData';

describe('mockData Shapes', () => {
  describe('mockPlayers', () => {
    it('has required fields for each player', () => {
      mockPlayers.forEach(player => {
        expect(player).toHaveProperty('id');
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('initials');
        expect(typeof player.isMe).toBe('boolean');
        expect(typeof player.isHost).toBe('boolean');
        expect(player).toHaveProperty('status');
        expect(player).toHaveProperty('micStatus');
      });
    });

    it('has exactly one "me" player', () => {
      const mePlayers = mockPlayers.filter(p => p.isMe);
      expect(mePlayers.length).toBe(1);
    });
  });

  describe('mockObjectives', () => {
    it('each objective has id, text and completed fields', () => {
      mockObjectives.forEach(obj => {
        expect(obj).toHaveProperty('id');
        expect(obj).toHaveProperty('text');
        expect(typeof obj.completed).toBe('boolean');
        expect(obj.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('mockEvidenceLog', () => {
    it('each evidence has id, name, status, and icon', () => {
      mockEvidenceLog.forEach(ev => {
        expect(ev).toHaveProperty('id');
        expect(ev).toHaveProperty('name');
        expect(ev).toHaveProperty('status');
        expect(ev).toHaveProperty('icon');
      });
    });

    it('status is one of: revealed, locked', () => {
      const validStatuses = ['revealed', 'locked'];
      mockEvidenceLog.forEach(ev => {
        expect(validStatuses).toContain(ev.status);
      });
    });
  });

  describe('mockTimeline', () => {
    it('each timeline event has date and event fields', () => {
      mockTimeline.forEach(entry => {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('event');
        expect(entry.event.length).toBeGreaterThan(0);
      });
    });
  });

  describe('mockRevealData', () => {
    it('has success flag and murdererName', () => {
      expect(mockRevealData).toHaveProperty('success', true);
      expect(mockRevealData).toHaveProperty('murdererName');
      expect(mockRevealData.murdererName.length).toBeGreaterThan(0);
    });

    it('has stats with expected fields', () => {
      expect(mockRevealData.stats).toHaveProperty('votesCorrect');
      expect(mockRevealData.stats).toHaveProperty('totalPlayers');
      expect(mockRevealData.stats).toHaveProperty('timeTaken');
      expect(mockRevealData.stats).toHaveProperty('accuracy');
    });
  });
});
