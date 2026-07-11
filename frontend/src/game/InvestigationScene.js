// InvestigationScene.js — Phaser 3 2D Investigation Gaming Area
import Phaser from 'phaser';

export class InvestigationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'InvestigationScene' });
    this.player = null;
    this.remotePlayers = {};
    this.npcs = {};
    this.clues = [];
    this.cursors = null;
    this.wasd = null;
    
    // Callbacks to React
    this.onPlayerMove = null;
    this.onInteractNPC = null;
    this.onInspectClue = null;
    
    // Room details
    this.roomCode = null;
    this.myUsername = null;
    this.initialPlayers = [];
    this.initialSuspects = [];
  }

  init(data) {
    this.roomCode = data.roomCode;
    this.myUsername = data.username;
    this.initialPlayers = data.players || [];
    this.initialSuspects = data.suspects || [];
    this.onPlayerMove = data.onPlayerMove || null;
    this.onInteractNPC = data.onInteractNPC || null;
    this.onInspectClue = data.onInspectClue || null;
  }

  preload() {
    // Load study/room background
    this.load.image('room_bg', '/src/assets/meeting_room_bg.png');
    // Load a simple magnifying glass/clue texture
    this.load.image('clue_icon', '/src/assets/crime_scene_bg.png');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // --- Boundaries ---
    this.physics.world.setBounds(0, 0, W, H);

    // --- Background ---
    const bg = this.add.image(W / 2, H / 2, 'room_bg');
    bg.setDisplaySize(W, H);

    // --- Keyboard controls ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      interact: Phaser.Input.Keyboard.KeyCodes.E
    });

    // --- Local Player ---
    const startX = W / 2;
    const startY = H / 2 + 100;
    this.player = this.physics.add.container(startX, startY);
    this.player.setSize(44, 44);
    
    // Draw character silhouette
    const playerGfx = this.add.graphics();
    this.drawCharacterGfx(playerGfx, 0, 0, 0xf1c40f, true); // Gold outline for local player
    this.player.add(playerGfx);

    // Player name tag
    const nameTag = this.add.text(0, -50, 'YOU', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#f1c40f',
      backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 }
    }).setOrigin(0.5, 1);
    this.player.add(nameTag);

    // Enable physics for local player
    this.player.body.setCollideWorldBounds(true);

    // --- Spawn NPCs (Suspects) ---
    this.spawnNPCs();

    // --- Spawn Clue Hotspots ---
    this.spawnClueHotspots();

    // --- Spawn Remote Players ---
    this.initialPlayers.forEach(p => {
      if (p.name !== this.myUsername) {
        this.addRemotePlayer(p.name);
      }
    });

    // --- Mouse Pointer Destination Target ---
    this.destination = null;
    this.input.on('pointerdown', (pointer) => {
      // Exclude clicks on UI panel/menus
      if (pointer.y > 60) {
        this.destination = { x: pointer.x, y: pointer.y };
        this.showDestinationMarker(pointer.x, pointer.y);
      }
    });

    // --- Speech indicator overlay (reused) ---
    this.hudText = this.add.text(W / 2, H - 20, 'WASD/Click to Walk | Walk to suspects or clues & press E', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#888877',
      backgroundColor: '#000000bb',
      padding: { left: 10, right: 10, top: 4, bottom: 4 }
    }).setOrigin(0.5, 1);

    // --- Notification Tooltip ---
    this.tooltip = this.add.text(W / 2, 80, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#ffd700',
      backgroundColor: '#1c0a0fee',
      padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5, 0).setDepth(200).setAlpha(0);
  }

  update() {
    if (!this.player) return;

    let vx = 0;
    let vy = 0;
    const speed = 180;

    // Keyboard inputs
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      vx = -speed;
      this.destination = null;
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      vx = speed;
      this.destination = null;
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      vy = -speed;
      this.destination = null;
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      vy = speed;
      this.destination = null;
    }

    // Direct movement to mouse click destination
    if (this.destination) {
      const dx = this.destination.x - this.player.x;
      const dy = this.destination.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        this.destination = null;
        if (this.marker) this.marker.destroy();
      } else {
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
      }
    }

    this.player.body.setVelocity(vx, vy);

    // Emit position change to React
    if ((vx !== 0 || vy !== 0) && this.onPlayerMove) {
      this.onPlayerMove(this.player.x, this.player.y);
    }

    // Check interaction overlaps
    this.checkProximities();
  }

  drawCharacterGfx(gfx, x, y, color, isLocal) {
    gfx.clear();
    // Coat body
    gfx.fillStyle(color, 0.9);
    gfx.fillEllipse(x, y, 32, 42);
    // Head
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y - 28, 14);
    // Hat
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 16, y - 40, 32, 4);
    gfx.fillRect(x - 10, y - 52, 20, 12);

    if (isLocal) {
      gfx.lineStyle(2, 0xffd700, 1);
      gfx.strokeCircle(x, y - 28, 16);
    }
  }

  spawnNPCs() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Define positions in study/room
    const npcPositions = [
      { name: 'Arthur Pendelton', x: 250, y: 220, color: 0x3498db },
      { name: 'Beatrice Thorne', x: W - 250, y: 220, color: 0xe74c3c },
      { name: 'Victor Vance', x: 220, y: H - 220, color: 0x2ecc71 },
      { name: 'Eleanor Vance', x: W - 220, y: H - 220, color: 0x9b59b6 }
    ];

    npcPositions.forEach(pos => {
      const container = this.add.container(pos.x, pos.y);
      container.setSize(44, 44);
      
      const gfx = this.add.graphics();
      this.drawCharacterGfx(gfx, 0, 0, pos.color, false);
      container.add(gfx);

      const nameTag = this.add.text(0, -50, pos.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#00000080',
        padding: { left: 4, right: 4, top: 2, bottom: 2 }
      }).setOrigin(0.5, 1);
      container.add(nameTag);

      this.npcs[pos.name] = container;
    });
  }

  spawnClueHotspots() {
    const W = this.scale.width;
    const H = this.scale.height;

    const clueSpots = [
      { id: 'e1', name: 'Shattered Glass', x: W / 2 - 150, y: H / 2 - 50 },
      { id: 'e2', name: 'Torn Velvet', x: W / 2 + 180, y: H / 2 + 60 }
    ];

    clueSpots.forEach(clue => {
      const marker = this.add.container(clue.x, clue.y);
      marker.setSize(30, 30);

      // Draw search circle
      const circ = this.add.circle(0, 0, 14, 0xffd700, 0.25);
      circ.setStrokeStyle(1.5, 0xffd700);
      marker.add(circ);

      // Add a smaller blinking dot
      const pulse = this.add.circle(0, 0, 4, 0xffd700, 1);
      this.tweens.add({
        targets: pulse,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 800,
        yoyo: false,
        repeat: -1
      });
      marker.add(pulse);

      const label = this.add.text(0, -22, '🔍 CLUE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#ffd700',
        backgroundColor: '#000000aa',
        padding: { left: 4, right: 4, top: 1, bottom: 1 }
      }).setOrigin(0.5, 1);
      marker.add(label);

      this.clues.push({ id: clue.id, name: clue.name, container: marker });
    });
  }

  addRemotePlayer(username) {
    if (this.remotePlayers[username]) return;

    const W = this.scale.width;
    const H = this.scale.height;

    const container = this.add.container(W / 2 + (Math.random() * 100 - 50), H / 2 + (Math.random() * 100 - 50));
    container.setSize(44, 44);

    const gfx = this.add.graphics();
    this.drawCharacterGfx(gfx, 0, 0, 0x7f8c8d, false); // Grey outline for remote players
    container.add(gfx);

    const nameTag = this.add.text(0, -50, username.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#aaaaaa',
      backgroundColor: '#00000080',
      padding: { left: 4, right: 4, top: 2, bottom: 2 }
    }).setOrigin(0.5, 1);
    container.add(nameTag);

    this.remotePlayers[username] = container;
  }

  removeRemotePlayer(username) {
    if (this.remotePlayers[username]) {
      this.remotePlayers[username].destroy();
      delete this.remotePlayers[username];
    }
  }

  updateRemotePlayerPos(username, x, y) {
    // If player not spawned yet, spawn them
    if (!this.remotePlayers[username]) {
      this.addRemotePlayer(username);
    }
    const container = this.remotePlayers[username];
    if (container) {
      // Tween movement for smoothness
      this.tweens.add({
        targets: container,
        x: x,
        y: y,
        duration: 120,
        ease: 'Linear'
      });
    }
  }

  showDestinationMarker(x, y) {
    if (this.marker) this.marker.destroy();
    
    this.marker = this.add.circle(x, y, 6, 0xf1c40f, 0.4);
    this.marker.setStrokeStyle(1.5, 0xf1c40f);
    
    this.tweens.add({
      targets: this.marker,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        if (this.marker) this.marker.destroy();
      }
    });
  }

  checkProximities() {
    let nearestText = '';
    let foundInteractable = false;

    // 1. Check NPCs
    Object.entries(this.npcs).forEach(([name, container]) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, container.x, container.y);
      if (dist < 60) {
        nearestText = `💬 Press E or Click to INTERROGATE ${name.toUpperCase()}`;
        foundInteractable = true;

        if (Phaser.Input.Keyboard.JustDown(this.wasd.interact)) {
          if (this.onInteractNPC) this.onInteractNPC(name);
        }
      }
    });

    // 2. Check Clues
    this.clues.forEach(clue => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, clue.container.x, clue.container.y);
      if (dist < 50) {
        nearestText = `🔎 Press E or Click to INSPECT ${clue.name.toUpperCase()}`;
        foundInteractable = true;

        if (Phaser.Input.Keyboard.JustDown(this.wasd.interact)) {
          if (this.onInspectClue) this.onInspectClue(clue.id, clue.name);
        }
      }
    });

    if (foundInteractable) {
      this.tooltip.setText(nearestText);
      this.tooltip.setAlpha(1);
    } else {
      this.tooltip.setAlpha(0);
    }
  }
}
