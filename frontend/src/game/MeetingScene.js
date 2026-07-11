// MeetingScene.js — Phaser 3 Scene for the Murder Mystery Meeting Room
// Uses Phaser 3, the industry-standard 2D game engine

import Phaser from 'phaser';

// Seat positions around the round table (normalized for 1280x720)
const SEAT_POSITIONS = [
  { x: 640, y: 220 }, // Top
  { x: 850, y: 280 }, // Top-Right
  { x: 880, y: 480 }, // Bottom-Right
  { x: 640, y: 540 }, // Bottom
  { x: 400, y: 480 }, // Bottom-Left
  { x: 410, y: 280 }, // Top-Left
];

// Detective silhouette colors for each player
const PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c];

export class MeetingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MeetingScene' });
    this.playerSprites = {};
    this.nameTexts = {};
    this.speechBubbles = {};
    this.votedOn = null;
    this.onVote = null;
    this.players = [];
    this.murdererName = null;
    this.timeLeft = 600; // 10 minutes
    this.timerText = null;
    this.timerEvent = null;
    this.onTimerEnd = null;
    this.voteCounts = {};
    this.voteIndicators = {};
    this.resultShown = false;
  }

  init(data) {
    this.players = data.players || [];
    this.murdererName = data.murdererName || null;
    this.timeLeft = data.duration || 600;
    this.onVote = data.onVote || null;
    this.onTimerEnd = data.onTimerEnd || null;
    this.voteCounts = {};
    this.players.forEach(p => { this.voteCounts[p.name] = 0; });
  }

  preload() {
    // Load the AI-generated background
    this.load.image('meeting_room', '/src/assets/meeting_room_bg.png');
    // Load a simple table texture
    this.load.image('table', '/src/assets/meeting_room_bg.png');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // --- Background ---
    const bg = this.add.image(W / 2, H / 2, 'meeting_room');
    bg.setDisplaySize(W, H);

    // --- Dark vignette overlay ---
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0, 0.7);
    vignette.fillRect(0, 0, W, H);
    vignette.setAlpha(0.35);

    // --- Round Table (drawn programmatically) ---
    // Disabled programmatic 2D table to show the beautiful detailed background scenery table instead.
    // this.drawTable(W / 2, H / 2 - 20);

    // --- Player Characters ---
    this.players.forEach((player, idx) => {
      if (idx >= SEAT_POSITIONS.length) return;
      const pos = SEAT_POSITIONS[idx];
      const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];

      // Draw detective silhouette
      const gfx = this.add.graphics();
      this.drawDetectiveSilhouette(gfx, 0, 0, color, player.isMe);

      // Create a container so we can position it
      const container = this.add.container(pos.x, pos.y);
      container.add(gfx);

      // Chair shadow
      const chairGfx = this.add.graphics();
      chairGfx.fillStyle(0x2c1810, 1);
      chairGfx.fillEllipse(0, 42, 56, 22);
      container.addAt(chairGfx, 0);

      // Player name label
      const nameText = this.add.text(0, -80, player.name.toUpperCase(), {
        fontFamily: '"Courier New", monospace',
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#00000080',
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
      }).setOrigin(0.5, 1);
      container.add(nameText);

      // YOU badge
      if (player.isMe) {
        const youTag = this.add.text(0, -100, '● YOU', {
          fontFamily: '"Courier New", monospace',
          fontSize: '10px',
          color: '#f1c40f',
        }).setOrigin(0.5, 1);
        container.add(youTag);
      }

      // Vote count badge (hidden initially)
      const voteBadge = this.add.text(30, -50, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        color: '#e74c3c',
        backgroundColor: '#000000cc',
        padding: { left: 5, right: 5, top: 2, bottom: 2 },
      }).setOrigin(0, 0.5).setAlpha(0);
      container.add(voteBadge);

      // Click interaction (only other players can be voted on, not yourself)
      if (!player.isMe) {
        const hitZone = this.add.rectangle(0, -10, 60, 100, 0xffffff, 0);
        hitZone.setInteractive({ cursor: 'pointer' });
        container.add(hitZone);

        // Hover glow effect
        hitZone.on('pointerover', () => {
          gfx.setAlpha(0.8);
          this.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 120, ease: 'Power2' });
          this.showTooltip(pos.x, pos.y - 110, `Click to VOTE for ${player.name}`);
        });
        hitZone.on('pointerout', () => {
          gfx.setAlpha(1);
          this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120, ease: 'Power2' });
          this.hideTooltip();
        });
        hitZone.on('pointerdown', () => {
          if (!this.votedOn) {
            this.castVote(player, idx, container, gfx, voteBadge, color);
          }
        });
      }

      this.playerSprites[player.name] = { container, gfx, voteBadge, color };
    });

    // --- HUD: Timer ---
    this.timerBg = this.add.rectangle(W / 2, 40, 180, 44, 0x000000, 0.75);
    this.timerBg.setStrokeStyle(1, 0xe74c3c);
    this.timerText = this.add.text(W / 2, 40, this.formatTime(this.timeLeft), {
      fontFamily: '"Courier New", monospace',
      fontSize: '22px',
      color: '#ff4444',
    }).setOrigin(0.5, 0.5);

    this.timerLabel = this.add.text(W / 2, 22, 'MEETING IN PROGRESS', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5, 0.5);

    // --- Countdown Timer ---
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    });

    // --- Tooltip (reused) ---
    this.tooltip = this.add.text(0, 0, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#f1c40f',
      backgroundColor: '#1a0a0aee',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(0.5, 1).setDepth(100).setAlpha(0);

    // --- Ambient particle sparkles (candles) ---
    // this.addCandleParticles(W / 2, H / 2 - 20);

    // --- Entry animation ---
    this.cameras.main.setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 800, ease: 'Power2' });
  }

  drawTable(cx, cy) {
    // Table shadow
    const shadow = this.add.ellipse(cx + 8, cy + 12, 420, 200, 0x000000, 0.5);

    // Main table surface
    const table = this.add.ellipse(cx, cy, 420, 200, 0x3d1a00);
    table.setStrokeStyle(4, 0x6b3a1f);

    // Table cloth / felt
    const felt = this.add.ellipse(cx, cy, 380, 175, 0x2a1200);

    // Center candelabra
    const candle = this.add.circle(cx, cy, 20, 0x8B6914);
    candle.setStrokeStyle(2, 0xf1c40f);

    // Flame glow (pulsing)
    const flame = this.add.circle(cx, cy - 15, 8, 0xff8800, 0.9);
    this.tweens.add({
      targets: flame,
      alpha: 0.5,
      scaleX: 0.8,
      scaleY: 1.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Candle glow aura
    const glow = this.add.circle(cx, cy - 10, 40, 0xff6600, 0.1);
    this.tweens.add({
      targets: glow,
      alpha: 0.2,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  drawDetectiveSilhouette(gfx, x, y, color, isMe) {
    gfx.clear();

    // Coat body
    gfx.fillStyle(color, isMe ? 1 : 0.85);
    gfx.fillEllipse(x, y, 52, 66);

    // Head
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y - 44, 22);

    // Detective hat brim
    gfx.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(40).color, 1);
    gfx.fillRect(x - 22, y - 62, 44, 7);

    // Hat top
    gfx.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(30).color, 1);
    gfx.fillRect(x - 14, y - 80, 28, 20);

    // Collar / tie detail
    gfx.fillStyle(0x111111, 0.6);
    gfx.fillTriangle(x - 8, y - 22, x + 8, y - 22, x, y - 6);

    // Outline glow for "me" player
    if (isMe) {
      gfx.lineStyle(3, 0xffd700, 1);
      gfx.strokeCircle(x, y - 44, 24);
      gfx.strokeEllipse(x, y, 55, 70);
    }
  }

  castVote(player, idx, container, gfx, voteBadge, color) {
    this.votedOn = player.name;

    // Flash the selected character
    this.tweens.add({
      targets: container,
      y: container.y - 15,
      duration: 200,
      yoyo: true,
      ease: 'Power2',
    });

    // Draw red selection ring
    const ring = this.add.circle(container.x, container.y - 10, 50, 0xe74c3c, 0);
    ring.setStrokeStyle(3, 0xe74c3c);
    this.tweens.add({ targets: ring, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 300, ease: 'Power2' });

    // Show "VOTED" text
    const votedText = this.add.text(container.x, container.y - 110, '⚠ VOTED', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#e74c3c',
      backgroundColor: '#1a0000cc',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5, 1).setAlpha(0);
    this.tweens.add({ targets: votedText, alpha: 1, y: container.y - 120, duration: 400 });

    // Emit vote to parent
    if (this.onVote) {
      this.onVote(player.name, player.id);
    }
  }

  updateVoteCount(playerName, count) {
    const sprite = this.playerSprites[playerName];
    if (sprite) {
      sprite.voteBadge.setText(`${count} VOTE${count !== 1 ? 'S' : ''}`);
      sprite.voteBadge.setAlpha(1);
    }
    this.voteCounts[playerName] = count;
  }

  showSpeaking(playerName) {
    const sprite = this.playerSprites[playerName];
    if (!sprite) return;

    // Speech bubble shake
    this.tweens.add({
      targets: sprite.container,
      x: sprite.container.x + 3,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });

    // Speech dot indicator
    const bubble = this.add.text(sprite.container.x + 30, sprite.container.y - 60, '💬', {
      fontSize: '18px',
    }).setOrigin(0.5, 1);

    this.tweens.add({
      targets: bubble,
      y: sprite.container.y - 80,
      alpha: 0,
      duration: 1800,
      ease: 'Power2',
      onComplete: () => bubble.destroy(),
    });
  }

  showResult(playersWin, murdererName) {
    if (this.resultShown) return;
    this.resultShown = true;

    // Stop timer
    if (this.timerEvent) this.timerEvent.remove();

    const W = this.scale.width;
    const H = this.scale.height;

    // Full screen overlay
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0);
    this.tweens.add({ targets: overlay, alpha: 0.75, duration: 600 });

    if (playersWin) {
      // PLAYERS WIN
      const title = this.add.text(W / 2, H / 2 - 80, '🎉 CASE SOLVED!', {
        fontFamily: '"Georgia", serif',
        fontSize: '52px',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0);

      const sub = this.add.text(W / 2, H / 2, `${murdererName} was the murderer.`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '22px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0);

      const detail = this.add.text(W / 2, H / 2 + 50, 'The investigators prevailed. Justice is served.', {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#27ae60',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: [title, sub, detail], alpha: 1, y: '-=20', duration: 800, ease: 'Power2', delay: 400 });

      // Particle celebration
      const particles = this.add.particles(W / 2, H / 2 - 100, 'meeting_room', {
        speed: { min: 100, max: 300 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.05, end: 0 },
        lifespan: 1500,
        quantity: 3,
        tint: [0xf1c40f, 0xe74c3c, 0x27ae60],
      });
      this.time.delayedCall(4000, () => particles.destroy());
    } else {
      // MURDERER WINS
      const title = this.add.text(W / 2, H / 2 - 80, '💀 MURDERER WINS', {
        fontFamily: '"Georgia", serif',
        fontSize: '52px',
        color: '#e74c3c',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0);

      const sub = this.add.text(W / 2, H / 2, `${murdererName} escapes justice.`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '22px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0);

      const detail = this.add.text(W / 2, H / 2 + 50, 'The killer remains free. The case goes cold.', {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#e74c3c',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: [title, sub, detail], alpha: 1, duration: 800, ease: 'Power2', delay: 400 });

      // Screen shake on loss
      this.cameras.main.shake(800, 0.015);
    }
  }

  tickTimer() {
    this.timeLeft -= 1;
    this.timerText.setText(this.formatTime(this.timeLeft));

    // Flash red when under 60 seconds
    if (this.timeLeft <= 60 && this.timeLeft % 2 === 0) {
      this.timerText.setColor('#ff0000');
      this.cameras.main.flash(100, 100, 0, 0, true);
    } else if (this.timeLeft > 60) {
      this.timerText.setColor('#ff4444');
    }

    if (this.timeLeft <= 0) {
      this.timerEvent.remove();
      if (this.onTimerEnd) this.onTimerEnd();
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `⏱ ${m}:${s}`;
  }

  showTooltip(x, y, text) {
    this.tooltip.setText(text);
    this.tooltip.setPosition(x, y);
    this.tooltip.setAlpha(1);
  }

  hideTooltip() {
    this.tooltip.setAlpha(0);
  }

  addCandleParticles(cx, cy) {
    // Subtle ambient dust/ember particles near candle
    const ember = this.add.circle(4, 4, 2, 0xff8800);
    ember.setAlpha(0);
    ember.destroy();
  }
}
