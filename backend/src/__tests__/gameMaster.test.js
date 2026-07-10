"use strict";

/**
 * @file gameMaster.test.js
 * Unit and integration tests for Phase 8: AI Game Master.
 * Covers:
 *  - decideAction rules (stuck scenario, false accusations, repeated claims).
 *  - gameMasterAgent JSON parsing and validation.
 *  - gameMasterService execution, state updates, rate limiting, and event dispatching.
 */

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const GameState = require("../models/GameState");
const ChatMessage = require("../models/ChatMessage");
const gameMasterRules = require("../utils/gameMasterRules");
const gameMasterAgent = require("../services/ai/gameMasterAgent");
const gameMasterService = require("../services/gameMasterService");

// Mock ollamaService to avoid external API calls during testing
jest.mock("../services/ai/ollamaService", () => ({
  sendPrompt: jest.fn(),
}));
const ollamaService = require("../services/ai/ollamaService");

// Mock Socket.IO io export
jest.mock("../sockets/gameSocket", () => {
  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({ emit: emitMock });
  return {
    initSocket: jest.fn(),
    io: {
      to: toMock,
      emit: emitMock,
      _emitMock: emitMock,
      _toMock: toMock,
    },
  };
});
const { io: mockIo } = require("../sockets/gameSocket");

let mongoServer;

const sampleStory = {
  title: "Murder on the Orient Express",
  location: "Train Car 3",
  victim: {
    name: "Samuel Ratchett",
    description: "An American traveler with a dark past.",
  },
  crime: {
    type: "stabbing",
    weapon: "dagger",
    summary: "Ratchett was stabbed multiple times during the night.",
    killer: "Hector McQueen",
  },
  suspects: [
    {
      name: "Hector McQueen",
      background: "Ratchett's secretary",
      relationshipToVictim: "Secretary",
      isMurderer: true,
    },
    {
      name: "Edward Masterman",
      background: "Ratchett's valet",
      relationshipToVictim: "Valet",
      isMurderer: false,
    },
  ],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await GameState.deleteMany({});
  await ChatMessage.deleteMany({});
  jest.clearAllMocks();
});

describe("AI Game Master - Rules Engine (decideAction)", () => {
  test("returns shouldInvokeAI=false when no rules are met", () => {
    const decision = gameMasterRules.decideAction({
      recentMsgs: [
        { sender: "Alice", message: "Let's check the butler's room." },
        { sender: "Bob", message: "I agree, we need more clues." },
      ],
      discoveredClues: ["fingerprint"],
      timeElapsed: 120,
      story: sampleStory,
    });

    expect(decision.shouldInvokeAI).toBe(false);
    expect(decision.triggerType).toBeNull();
  });

  test("triggers 'stuck' scenario when time elapsed is high and no clues found", () => {
    const decision = gameMasterRules.decideAction({
      recentMsgs: [
        { sender: "Alice", message: "Where do we go?" },
        { sender: "Bob", message: "I have no idea. Stuck." },
      ],
      discoveredClues: [],
      timeElapsed: 305,
      story: sampleStory,
    });

    expect(decision.shouldInvokeAI).toBe(true);
    expect(decision.triggerType).toBe("stuck");
    expect(decision.reason).toContain("no clues found");
  });

  test("triggers 'false_accusation' when a player accuses the wrong suspect", () => {
    const decision = gameMasterRules.decideAction({
      recentMsgs: [
        { sender: "Alice", message: "I accuse Edward Masterman! He is the murderer!" },
      ],
      discoveredClues: ["dagger"],
      timeElapsed: 50,
      story: sampleStory,
    });

    expect(decision.shouldInvokeAI).toBe(true);
    expect(decision.triggerType).toBe("false_accusation");
    expect(decision.reason).toContain("falsely accused");
  });

  test("does not trigger 'false_accusation' when a player accuses the correct suspect", () => {
    const decision = gameMasterRules.decideAction({
      recentMsgs: [
        { sender: "Alice", message: "I accuse Hector McQueen! He is the murderer!" },
      ],
      discoveredClues: ["dagger"],
      timeElapsed: 50,
      story: sampleStory,
    });

    expect(decision.shouldInvokeAI).toBe(false);
  });

  test("triggers 'repeated_claims' when a player repeats the same message 3+ times", () => {
    const decision = gameMasterRules.decideAction({
      recentMsgs: [
        { sender: "Alice", message: "The valet did it" },
        { sender: "Bob", message: "Why?" },
        { sender: "Alice", message: "The valet did it" },
        { sender: "Alice", message: "The valet did it" },
      ],
      discoveredClues: ["fingerprint"],
      timeElapsed: 150,
      story: sampleStory,
    });

    expect(decision.shouldInvokeAI).toBe(true);
    expect(decision.triggerType).toBe("repeated_claims");
    expect(decision.reason).toContain("repeatedly claimed");
  });
});

describe("AI Game Master - Agent Parsing & Validation", () => {
  test("successfully parses valid JSON response from Ollama", () => {
    const raw = `{
      "actionType": "hint",
      "content": "The snow outside is blocking the train tracks.",
      "recipient": "all",
      "payload": { "details": "winter storm" }
    }`;

    const action = gameMasterAgent.parseAndValidateGMAction(raw);
    expect(action.actionType).toBe("hint");
    expect(action.content).toBe("The snow outside is blocking the train tracks.");
    expect(action.recipient).toBe("all");
  });

  test("strips markdown code blocks and parses correctly", () => {
    const raw = `\`\`\`json
    {
      "actionType": "event",
      "content": "A sudden scream echoes from Cabin 5.",
      "recipient": "all"
    }
    \`\`\``;

    const action = gameMasterAgent.parseAndValidateGMAction(raw);
    expect(action.actionType).toBe("event");
    expect(action.content).toBe("A sudden scream echoes from Cabin 5.");
  });

  test("throws error on missing or invalid fields", () => {
    const raw = `{
      "actionType": "invalidType",
      "content": "Hello"
    }`;

    expect(() => gameMasterAgent.parseAndValidateGMAction(raw)).toThrow("invalidType");
  });
});

describe("AI Game Master - Service Execution (processMessage)", () => {
  test("successfully runs processMessage, rates limits, and saves history", async () => {
    // 1. Create a GameState
    const state = await GameState.create({
      roomId: "GMRM01",
      story: {
        ...sampleStory,
        generatedAt: new Date(Date.now() - 310_000), // > 5 minutes ago to trigger stuck scenario
      },
    });

    // 2. Setup Ollama Mock Response
    const mockActionResponse = {
      actionType: "hint",
      content: "Perhaps you should look closer at Ratchett's cabin lock.",
      recipient: "all",
      payload: {},
    };
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(mockActionResponse));

    // 3. Process stuck scenario (no messages in DB, discoveredClues = [], timeElapsed > 300)
    await gameMasterService.processMessage("GMRM01", {
      senderUsername: "System",
      message: "Game started",
    });

    // Verify Ollama was called
    expect(ollamaService.sendPrompt).toHaveBeenCalled();

    // Verify GameState was updated
    const updatedState = await GameState.findOne({ roomId: "GMRM01" });
    expect(updatedState.story.gmHistory).toHaveLength(1);
    expect(updatedState.story.gmHistory[0].actionType).toBe("hint");
    expect(updatedState.story.gmHistory[0].content).toBe(mockActionResponse.content);

    expect(updatedState.story.pendingActions).toHaveLength(1);

    // Verify Socket.IO emits
    expect(mockIo._toMock).toHaveBeenCalledWith("GMRM01");
    expect(mockIo._emitMock).toHaveBeenCalledWith("gm-action", expect.objectContaining({
      actionType: "hint",
      content: mockActionResponse.content,
    }));
    expect(mockIo._emitMock).toHaveBeenCalledWith("gm-hint", expect.objectContaining({
      content: mockActionResponse.content,
    }));
  });

  test("honours rate limiting when too many GM actions are requested within a minute", async () => {
    // Create a GameState with existing recent gmHistory calls
    const recentDate = new Date();
    await GameState.create({
      roomId: "GMRM02",
      story: {
        ...sampleStory,
        generatedAt: new Date(Date.now() - 310_000),
        gmHistory: [
          { actionType: "hint", content: "hint 1", timestamp: recentDate },
          { actionType: "hint", content: "hint 2", timestamp: recentDate },
          { actionType: "hint", content: "hint 3", timestamp: recentDate },
          { actionType: "hint", content: "hint 4", timestamp: recentDate },
          { actionType: "hint", content: "hint 5", timestamp: recentDate }, // 5 calls, limit is 5
        ],
      },
    });

    await gameMasterService.processMessage("GMRM02", {
      senderUsername: "System",
      message: "Check",
    });

    // Ollama should NOT be called due to rate limiting
    expect(ollamaService.sendPrompt).not.toHaveBeenCalled();
  });
});
