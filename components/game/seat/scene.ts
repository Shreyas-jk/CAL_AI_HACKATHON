// Phaser scene for the conference seating game. SSR-safe: Phaser is received
// as a runtime argument (type-only import below), so this module never touches
// "window" at import time. Boot it from a client-only component via createGame().
import type PhaserNS from "phaser";
import { defaultPuzzle, type Puzzle, type SessionId, type Room, type Assignment, mood, wishStatus, happyCount, isWin, isClosed, occupantAt } from "./puzzle";
export interface GameOpts {
  puzzle?: Puzzle;
  onWin?: () => void;
}

const C = {
  cream: 0xf2e8d5,
  floor: 0xf7efde,
  floor2: 0xeee1c8,
  ink: 0x4a3f35,
  inkSoft: 0x6f6151,
  coral: 0xe39aa0,
  coralDk: 0xcd7f88,
  coralLt: 0xf3c6ca,
  wall: 0xd98c93,
  card: 0xf6cdd2,
  cardDk: 0xe7a9b0,
  paper: 0xfcf4e6,
  yellow: 0xf4c04a,
  good: 0x4fae7f,
  bad: 0xd9685f,
  grey: 0xb9ab95,
  white: 0xfffaf0,
};

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

export function createGame(Phaser: typeof PhaserNS, parent: HTMLElement, opts: GameOpts = {}) {
  const puzzle = opts.puzzle || defaultPuzzle;
  const onWin = opts.onWin;
  const FONT = "Nunito, Quicksand, Verdana, sans-serif";

  class ConferenceScene extends Phaser.Scene {
    assignment: Assignment = {};
    guests: Record<string, PhaserNS.GameObjects.Container> = {};
    inners: Record<string, PhaserNS.GameObjects.Container> = {};
    mouths: Record<string, PhaserNS.GameObjects.Graphics> = {};
    bubbles: Record<string, PhaserNS.GameObjects.Container> = {};
    home: Record<string, { x: number; y: number }> = {};
    seats: { room: Room; slot: number; x: number; y: number; rect: PhaserNS.Geom.Rectangle; closed: boolean }[] = [];
    selected: SessionId | null = null;
    cardContent!: PhaserNS.GameObjects.Container;
    countText!: PhaserNS.GameObjects.Text;
    confirmBg!: PhaserNS.GameObjects.Graphics;
    confirmTxt!: PhaserNS.GameObjects.Text;
    banner!: PhaserNS.GameObjects.Container;
    pauseButton!: PhaserNS.GameObjects.Container;
    pauseIcon!: PhaserNS.GameObjects.Graphics;
    pauseOverlay!: PhaserNS.GameObjects.Container;
    won = false;
    paused = false;

    constructor() {
      super("conference");
    }

    create() {
      this.drawBackground();
      this.drawInstruction();
      this.drawSign();
      this.drawPause();
      this.drawVenue();
      this.buildSeats();
      this.buildGuests();
      this.drawInfoCard();
      this.drawNotepad();
      this.drawBanner();

      this.selected = puzzle.sessions[0].id;
      (this.input as any).dragDistanceThreshold = 2;

      this.input.on("dragstart", (_p: any, obj: any) => {
        if (this.paused) return;
        this.children.bringToTop(obj);
        const id = obj.getData("id") as SessionId;
        this.selected = id;
        this.tweens.add({ targets: this.inners[id], scale: 1.14, duration: 120, ease: "Back.out" });
        this.renderCard();
      });
      this.input.on("drag", (_p: any, obj: any, dragX: number, dragY: number) => {
        if (this.paused) return;
        obj.x = dragX;
        obj.y = dragY;
      });
      this.input.on("dragend", (p: any, obj: any) => {
        if (this.paused) return;
        const id = obj.getData("id") as SessionId;
        this.tweens.add({ targets: this.inners[id], scale: 1, duration: 160, ease: "Back.out" });
        const seat = this.seats.find((s) => Phaser.Geom.Rectangle.Contains(s.rect, p.x, p.y));
        if (seat && !seat.closed) {
          this.placeAt(id, seat.room, seat.slot);
        } else {
          if (seat && seat.closed) this.shake(this.guests[id]);
          this.returnHome(id, true);
        }
        this.refresh();
      });

      this.refresh();
    }

    // ---- helpers -------------------------------------------------------
    rr(g: PhaserNS.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, fill: number, stroke?: number, sw = 3, fillAlpha = 1) {
      g.fillStyle(fill, fillAlpha);
      g.fillRoundedRect(x, y, w, h, r);
      if (stroke !== undefined) {
        g.lineStyle(sw, stroke, 1);
        g.strokeRoundedRect(x, y, w, h, r);
      }
    }

    txt(x: number, y: number, s: string, size: number, color: number, bold = false) {
      return this.add
        .text(x, y, s, { fontFamily: FONT, fontSize: size + "px", color: hex(color), fontStyle: bold ? "bold" : "normal" })
        .setOrigin(0.5);
    }

    // ---- static scenery ------------------------------------------------
    drawBackground() {
      const g = this.add.graphics();
      g.fillStyle(C.cream, 1);
      g.fillRect(0, 0, 1280, 720);
      g.fillStyle(0xffffff, 0.35);
      for (let i = 0; i < 70; i++) {
        const x = Phaser.Math.Between(0, 1280);
        const y = Phaser.Math.Between(0, 720);
        g.fillRect(x, y, 3, 3);
      }
    }

    drawInstruction() {
      const g = this.add.graphics();
      this.rr(g, 372, 30, 536, 40, 20, C.white, C.coral, 3);
      this.txt(640, 50, "Drag every talk into a seat so each guest is happy", 17, C.inkSoft, true);
    }

    drawSign() {
      const g = this.add.graphics();
      g.lineStyle(5, C.ink, 1);
      g.lineBetween(1040, 96, 1040, 132);
      g.lineBetween(1210, 96, 1210, 132);
      this.rr(g, 1004, 24, 244, 74, 16, C.white, C.ink, 4);
      this.rr(g, 1014, 34, 224, 54, 10, C.cream, C.coral, 3);
      this.txt(1126, 61, puzzle.venueName, 26, C.coralDk, true);
    }

    drawPause() {
      const g = this.add.graphics();
      g.fillStyle(C.coral, 1);
      g.fillCircle(48, 48, 24);
      g.lineStyle(4, C.ink, 1);
      g.strokeCircle(48, 48, 24);
      g.fillStyle(C.ink, 1);
      g.fillRoundedRect(40, 38, 6, 20, 2);
      g.fillRoundedRect(51, 38, 6, 20, 2);
      this.pauseIcon = g;
      const hit = this.add.circle(48, 48, 34, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", (p: any) => {
        p.event?.stopPropagation?.();
        this.togglePause();
      });
      this.pauseButton = this.add.container(0, 0, [g, hit]);
      this.pauseButton.setDepth(1000);
      this.drawPauseOverlay();
    }

    drawPauseOverlay() {
      const shade = this.add.rectangle(640, 360, 1280, 720, 0x4a3f35, 0.32);
      const panel = this.add.graphics();
      this.rr(panel, 475, 270, 330, 150, 22, C.white, C.ink, 4);
      const title = this.add.text(640, 326, "Paused", { fontFamily: FONT, fontSize: "34px", color: hex(C.coralDk), fontStyle: "bold" }).setOrigin(0.5);
      const hint = this.add.text(640, 366, "Tap pause again to keep seating talks", { fontFamily: FONT, fontSize: "16px", color: hex(C.inkSoft) }).setOrigin(0.5);
      this.pauseOverlay = this.add.container(0, 0, [shade, panel, title, hint]);
      this.pauseOverlay.setDepth(900);
      this.pauseOverlay.setVisible(false);
    }

    redrawPauseIcon() {
      this.pauseIcon.clear();
      this.pauseIcon.fillStyle(this.paused ? C.good : C.coral, 1);
      this.pauseIcon.fillCircle(48, 48, 24);
      this.pauseIcon.lineStyle(4, C.ink, 1);
      this.pauseIcon.strokeCircle(48, 48, 24);
      this.pauseIcon.fillStyle(C.ink, 1);
      if (this.paused) {
        this.pauseIcon.fillTriangle(42, 36, 42, 60, 61, 48);
      } else {
        this.pauseIcon.fillRoundedRect(40, 38, 6, 20, 2);
        this.pauseIcon.fillRoundedRect(51, 38, 6, 20, 2);
      }
    }

    togglePause() {
      this.paused = !this.paused;
      if (this.paused) this.tweens.pauseAll();
      else this.tweens.resumeAll();
      this.pauseOverlay.setVisible(this.paused);
      this.redrawPauseIcon();
    }

    drawVenue() {
      const g = this.add.graphics();
      // floor
      this.rr(g, 300, 92, 690, 472, 26, C.floor, C.wall, 6);
      // checkerboard
      const x0 = 300, y0 = 92, w = 690, h = 472, tile = 47;
      const mask = this.make.graphics({});
      mask.fillRoundedRect(x0, y0, w, h, 26);
      const cb = this.add.graphics();
      cb.fillStyle(C.floor2, 0.55);
      for (let r = 0; r * tile < h; r++) {
        for (let c = 0; c * tile < w; c++) {
          if ((r + c) % 2 === 0) cb.fillRect(x0 + c * tile, y0 + r * tile, tile, tile);
        }
      }
      cb.setMask(mask.createGeometryMask());
      // re-stroke the wall on top of checker
      const g2 = this.add.graphics();
      g2.lineStyle(6, C.wall, 1);
      g2.strokeRoundedRect(300, 92, 690, 472, 26);
    }

    drawBooth(g: PhaserNS.GameObjects.Graphics, x: number, y: number, closed: boolean) {
      // booth back + seat cushion, top-down
      const back = closed ? C.grey : C.coral;
      const cush = closed ? 0xcfc3ad : C.coralLt;
      // back rest
      this.rr(g, x - 52, y - 50, 104, 26, 12, back, C.ink, 3);
      // seat cushion
      this.rr(g, x - 46, y - 26, 92, 64, 14, cush, C.ink, 3);
      // little stripe accents on back
      g.fillStyle(closed ? 0xbcb097 : C.coralDk, 1);
      g.fillRoundedRect(x - 30, y - 47, 8, 20, 3);
      g.fillRoundedRect(x + 22, y - 47, 8, 20, 3);
    }

    buildSeats() {
      const gx = 378, gy = 130, colW = 150, rowH = 140;
      // slot labels (top)
      for (let i = 0; i < puzzle.slots.length; i++) {
        this.txt(gx + colW * i + colW / 2, 112, puzzle.slots[i], 15, C.inkSoft, true);
      }
      const g = this.add.graphics();
      for (let j = 0; j < puzzle.rooms.length; j++) {
        const room = puzzle.rooms[j];
        // room label (left)
        this.txt(339, gy + rowH * j + rowH / 2 - 8, "Room " + room.id, 15, C.ink, true);
        this.txt(339, gy + rowH * j + rowH / 2 + 10, room.name, 11, C.inkSoft);
        for (let i = 0; i < puzzle.slots.length; i++) {
          const x = gx + colW * i + colW / 2;
          const y = gy + rowH * j + rowH / 2;
          const closed = isClosed(room.id, i);
          this.drawBooth(g, x, y, closed);
          if (closed) {
            const cg = this.add.graphics();
            cg.lineStyle(4, C.bad, 0.85);
            cg.lineBetween(x - 40, y - 20, x + 40, y + 28);
            cg.lineBetween(x + 40, y - 20, x - 40, y + 28);
            this.txt(x, y + 44, "CLOSED", 11, C.bad, true);
          }
          this.seats.push({ room: room.id, slot: i, x, y, rect: new Phaser.Geom.Rectangle(x - 58, y - 56, 116, 116), closed });
        }
      }
    }

    // ---- guests --------------------------------------------------------
    drawMouth(g: PhaserNS.GameObjects.Graphics, m: string) {
      g.clear();
      g.lineStyle(3, C.ink, 1);
      if (m === "happy") {
        g.beginPath();
        g.arc(0, 2, 8, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
        g.strokePath();
      } else if (m === "sad") {
        g.beginPath();
        g.arc(0, 14, 8, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
        g.strokePath();
      } else if (m === "waiting") {
        g.strokeCircle(0, 8, 3.2);
      } else {
        g.lineBetween(-6, 8, 6, 8);
      }
    }

    buildGuests() {
      const slots = puzzle.sessions.length;
      const startX = 300, spanW = 690;
      const step = spanW / slots;
      puzzle.sessions.forEach((def, i) => {
        const hx = startX + step * i + step / 2;
        const hy = 640;
        this.home[def.id] = { x: hx, y: hy };

        const inner = this.add.container(0, 0);
        // shadow
        const sh = this.add.ellipse(0, 32, 64, 16, 0x000000, 0.12);
        // body
        const body = this.add.graphics();
        this.rr(body, -28, -28, 56, 56, 18, def.color, C.ink, 3);
        // eyes
        const eL = this.add.circle(-10, -6, 3.4, C.ink, 1);
        const eR = this.add.circle(10, -6, 3.4, C.ink, 1);
        // mouth
        const mouth = this.add.graphics();
        this.drawMouth(mouth, "idle");
        // emoji "hat" badge
        const badge = this.add.text(0, -44, def.emoji, { fontFamily: FONT, fontSize: "24px" }).setOrigin(0.5);
        inner.add([sh, body, eL, eR, mouth, badge]);
        this.mouths[def.id] = mouth;
        this.inners[def.id] = inner;

        // idle bob (targets inner so it never fights position tweens)
        this.tweens.add({ targets: inner, y: -4, duration: 1300, ease: "Sine.inOut", yoyo: true, repeat: -1, delay: i * 160 });

        // bubble (on outer, fixed above head)
        const bubble = this.makeBubble();
        this.bubbles[def.id] = bubble;

        const outer = this.add.container(hx, hy, [inner, bubble]);
        outer.setData("id", def.id);
        outer.setSize(96, 112);
        outer.setInteractive(new Phaser.Geom.Rectangle(-48, -58, 96, 118), Phaser.Geom.Rectangle.Contains);
        (outer.input as any).cursor = "grab";
        this.input.setDraggable(outer);
        outer.on("pointerover", () => {
          if (this.paused) return;
          this.selected = def.id;
          this.renderCard();
        });
        outer.on("pointerdown", () => {
          if (this.paused) return;
          this.children.bringToTop(outer);
          this.selected = def.id;
          this.renderCard();
        });
        this.guests[def.id] = outer;
      });
    }

    makeBubble(): PhaserNS.GameObjects.Container {
      const bg = this.add.graphics();
      const t = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "13px", color: hex(C.ink), align: "center" }).setOrigin(0.5);
      const c = this.add.container(0, -62, [bg, t]);
      c.setData("bg", bg);
      c.setData("t", t);
      c.setAlpha(0);
      return c;
    }

    showBubble(id: SessionId, text: string | null) {
      const c = this.bubbles[id];
      const bg = c.getData("bg") as PhaserNS.GameObjects.Graphics;
      const t = c.getData("t") as PhaserNS.GameObjects.Text;
      if (!text) {
        if (c.alpha > 0) this.tweens.add({ targets: c, alpha: 0, duration: 150 });
        return;
      }
      t.setText(text);
      const w = Math.max(46, t.width + 20);
      const h = t.height + 14;
      bg.clear();
      this.rr(bg, -w / 2, -h / 2, w, h, 10, C.paper, C.ink, 2);
      bg.fillStyle(C.paper, 1);
      bg.lineStyle(2, C.ink, 1);
      bg.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 9);
      if (c.alpha < 1) {
        c.setScale(0.6);
        this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: "Back.out" });
      }
    }

    // ---- placement -----------------------------------------------------
    placeAt(id: SessionId, room: Room, slot: number) {
      const prev = occupantAt(this.assignment, room, slot);
      if (prev && prev !== id) this.returnHome(prev, true);
      this.assignment[id] = { room, slot };
      const seat = this.seats.find((s) => s.room === room && s.slot === slot)!;
      this.tweens.add({ targets: this.guests[id], x: seat.x, y: seat.y, duration: 240, ease: "Back.out" });
    }

    returnHome(id: SessionId, animate: boolean) {
      delete this.assignment[id];
      const h = this.home[id];
      if (animate) this.tweens.add({ targets: this.guests[id], x: h.x, y: h.y, duration: 240, ease: "Back.out" });
      else this.guests[id].setPosition(h.x, h.y);
    }

    shake(obj: PhaserNS.GameObjects.Container) {
      const x0 = obj.x;
      this.tweens.add({ targets: obj, x: x0 - 7, duration: 60, yoyo: true, repeat: 3, onComplete: () => obj.setX(x0) });
    }

    bumpCount() {
      this.tweens.add({ targets: this.countText, scale: 1.3, duration: 120, yoyo: true, ease: "Quad.out" });
    }

    // ---- info card -----------------------------------------------------
    drawInfoCard() {
      const g = this.add.graphics();
      // stacked cards behind
      this.rr(g, 30, 484, 256, 212, 16, C.cardDk, C.ink, 3);
      this.rr(g, 24, 478, 256, 212, 16, C.cardDk, C.ink, 3);
      this.rr(g, 18, 470, 256, 214, 16, C.card, C.ink, 3);
      this.cardContent = this.add.container(18, 470);
    }

    renderCard() {
      if (!this.cardContent) return;
      this.cardContent.removeAll(true);
      const id = this.selected;
      if (!id) return;
      const def = puzzle.sessions.find((s) => s.id === id)!;
      const items: PhaserNS.GameObjects.GameObject[] = [];
      // header
      const head = this.add.text(20, 14, def.emoji + "  " + def.name, {
        fontFamily: FONT,
        fontSize: "18px",
        color: hex(C.ink),
        fontStyle: "bold",
        wordWrap: { width: 146 },
      });
      items.push(head);
      // tag pill (right)
      const tg = this.add.graphics();
      const tw = 12 + def.tag.length * 8;
      this.rr(tg, 254 - tw - 16, 16, tw, 24, 12, C.coral, C.ink, 2);
      const tgt = this.add.text(254 - tw - 16 + tw / 2, 28, def.tag, { fontFamily: FONT, fontSize: "12px", color: hex(C.white), fontStyle: "bold" }).setOrigin(0.5);
      items.push(tg, tgt);
      // divider
      const dv = this.add.graphics();
      dv.lineStyle(2, C.cardDk, 1);
      dv.lineBetween(20, 58, 236, 58);
      items.push(dv);
      // wishes
      const ws = wishStatus(this.assignment, id);
      ws.forEach((w, i) => {
        const y = 76 + i * 34;
        const box = this.add.graphics();
        const col = w.state === "ok" ? C.good : w.state === "bad" ? C.bad : C.grey;
        this.rr(box, 20, y, 20, 20, 5, w.state === "ok" ? C.good : C.white, col, 2);
        const mark = this.add.text(30, y + 10, w.state === "ok" ? "\u2713" : w.state === "bad" ? "\u2717" : "", { fontFamily: FONT, fontSize: "15px", color: hex(w.state === "ok" ? C.white : C.bad), fontStyle: "bold" }).setOrigin(0.5);
        const label = this.add.text(48, y - 2, w.text, { fontFamily: FONT, fontSize: "13px", color: hex(C.ink), wordWrap: { width: 196 } });
        items.push(box, mark, label);
      });
      this.cardContent.add(items);
    }

    // ---- notepad -------------------------------------------------------
    drawNotepad() {
      const g = this.add.graphics();
      this.rr(g, 1000, 470, 262, 214, 14, C.paper, C.ink, 3);
      // spiral binding
      g.fillStyle(C.ink, 1);
      for (let x = 1024; x < 1244; x += 26) {
        g.fillCircle(x, 470, 4);
        g.fillStyle(C.cream, 1);
        g.fillCircle(x, 466, 6);
        g.fillStyle(C.ink, 1);
      }
      // faint ruled lines
      g.lineStyle(1, C.cardDk, 0.4);
      for (let y = 540; y < 600; y += 20) g.lineBetween(1018, y, 1244, y);

      this.add.text(1018, 492, "TO-DO: seat everyone", { fontFamily: FONT, fontSize: "14px", color: hex(C.inkSoft), fontStyle: "bold" });

      this.add.text(1024, 552, "\u{1F44D}", { fontFamily: FONT, fontSize: "28px" }).setOrigin(0.5);
      this.countText = this.add.text(1131, 552, "0/" + puzzle.sessions.length, { fontFamily: FONT, fontSize: "30px", color: hex(C.ink), fontStyle: "bold" }).setOrigin(0.5);
      this.add.text(1238, 552, "\u2B50", { fontFamily: FONT, fontSize: "26px" }).setOrigin(0.5);

      // confirm button
      this.confirmBg = this.add.graphics();
      const drawBtn = (on: boolean) => {
        this.confirmBg.clear();
        this.rr(this.confirmBg, 1018, 624, 226, 46, 14, on ? C.good : C.grey, C.ink, 3);
      };
      drawBtn(false);
      this.confirmTxt = this.add.text(1131, 647, "Confirm", { fontFamily: FONT, fontSize: "18px", color: hex(C.white), fontStyle: "bold" }).setOrigin(0.5);
      const hit = this.add.rectangle(1131, 647, 226, 46, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        if (isWin(this.assignment)) this.celebrate();
        else this.bumpCount();
      });
      (this as any)._drawBtn = drawBtn;
    }

    // ---- banner + win --------------------------------------------------
    drawBanner() {
      const g = this.add.graphics();
      this.rr(g, -300, -60, 600, 120, 20, C.white, C.good, 5);
      const t = this.add.text(0, -16, "Full house!", { fontFamily: FONT, fontSize: "34px", color: hex(C.good), fontStyle: "bold" }).setOrigin(0.5);
      const t2 = this.add.text(0, 24, "Every guest is happy \u{1F389}", { fontFamily: FONT, fontSize: "18px", color: hex(C.inkSoft) }).setOrigin(0.5);
      const c = this.add.container(645, 326, [g, t, t2]);
      c.setDepth(2000);
      c.setAlpha(0);
      c.setScale(0.8);
      this.banner = c;
    }

    celebrate() {
      this.children.bringToTop(this.banner);
      this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 360, ease: "Back.out", yoyo: true, hold: 1400 });
      // guests hop
      puzzle.sessions.forEach((s, i) => {
        this.tweens.add({ targets: this.inners[s.id], y: -16, duration: 220, ease: "Sine.out", yoyo: true, repeat: 1, delay: i * 70 });
      });
      // stars burst
      for (let i = 0; i < 16; i++) {
        const st = this.add.text(645, 326, Math.random() > 0.5 ? "\u2B50" : "\u2728", { fontFamily: FONT, fontSize: "22px" }).setOrigin(0.5).setDepth(2001);
        const ang = (Math.PI * 2 * i) / 16;
        this.tweens.add({
          targets: st,
          x: 645 + Math.cos(ang) * Phaser.Math.Between(140, 240),
          y: 326 + Math.sin(ang) * Phaser.Math.Between(110, 190),
          alpha: 0,
          angle: Phaser.Math.Between(-180, 180),
          duration: 1100,
          ease: "Cubic.out",
          onComplete: () => st.destroy(),
        });
      }
      if (onWin) onWin();
    }

    // ---- refresh -------------------------------------------------------
    refresh() {
      puzzle.sessions.forEach((s) => {
        const m = mood(this.assignment, s.id);
        this.drawMouth(this.mouths[s.id], m);
        if (m === "sad") {
          const bad = wishStatus(this.assignment, s.id).find((w) => w.state === "bad");
          this.showBubble(s.id, bad ? bad.short : "Hmm...");
        } else if (m === "happy") {
          this.showBubble(s.id, "\u2665");
        } else {
          this.showBubble(s.id, null);
        }
      });
      const n = happyCount(this.assignment);
      this.countText.setText(n + "/" + puzzle.sessions.length);
      this.countText.setColor(hex(isWin(this.assignment) ? C.good : C.ink));
      const drawBtn = (this as any)._drawBtn as (on: boolean) => void;
      if (drawBtn) drawBtn(isWin(this.assignment));
      this.renderCard();
      if (isWin(this.assignment) && !this.won) {
        this.won = true;
        this.celebrate();
      }
      if (!isWin(this.assignment)) this.won = false;
    }
  }

  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: hex(C.cream),
    input: { activePointers: 3 },
    fps: { target: 60, smoothStep: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: ConferenceScene,
  });
}
