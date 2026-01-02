# microRacer Technical Documentation

This document outlines the technical setup for developing microRacer using React for the UI shell, Vite for fast bundling, and Phaser.js for the core game engine. The stack enables a responsive web-based game with hot-seat multiplayer split-screen rendering in canvas.[1][2]

## Project Setup

Initialize with Vite's React TypeScript template for optimal performance and hot module replacement.

-   Run `npm create vite@latest microRacer -- --template react-ts` to scaffold.
-   Install Phaser: `npm install phaser` and types: `npm install -D @types/phaser`.
-   Core dependencies: React 18+, Vite 5+, Phaser 3.80+.
-   Scripts in package.json: `dev` for `vite`, `build` for production bundle, `preview` for testing.[2][1]

Project structure:

```
src/
├── App.tsx          # Root React component mounting Phaser canvas
├── main.tsx         # Vite entry point
├── game/            # Phaser scenes and logic
│   ├── GameScene.ts
│   ├── BootScene.ts
│   └── index.ts
├── components/      # React UI: menus, player select
└── assets/          # Images, audio for levels/vehicles
```

## Phaser Integration

Embed Phaser game instance in a React ref-managed div for lifecycle control.

In `Game.tsx`:

```tsx
import Phaser from "phaser";
import { useEffect, useRef } from "react";

const Game = () => {
    const gameRef = useRef<Phaser.Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && !gameRef.current) {
            gameRef.current = new Phaser.Game({
                type: Phaser.AUTO,
                parent: containerRef.current,
                width: window.innerWidth,
                height: window.innerHeight,
                scene: [BootScene, GameScene],
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            });
        }
        return () => {
            gameRef.current?.destroy(true);
        };
    }, []);

    return <div ref={containerRef} />;
};
```

Mount via `<Game />` in `App.tsx`. Phaser handles canvas rendering; React overlays menus.[3][2]

## Multiplayer Split-Screen

Implement 4-player hot-seat with Phaser camera groups for split views.

-   Detect players: Query `navigator.mediaDevices` or keyboard inputs; cycle turns via state.
-   In `GameScene.preload()`: Load 10 level tilemaps (JSON/TSV) and sprites for vehicles.
-   `create()`: Create 4 cameras; for 4 players: `this.cameras.main.setViewport(0, 0, width/2, height/2);` etc.
-   Input: Use Phaser's `addInput(splitPlayer, { targetCameras: [cam1] });` per player camera.
-   Turn logic: Pause physics, switch active player/camera on race end.[4][5]

Example camera setup:

```ts
const cameras = [];
for (let i = 0; i < 4; i++) {
    const cam = this.cameras.add(0, 0, width / 2, height / 2);
    cam.scrollX = ((i % 2) * width) / 2;
    cam.scrollY = (Math.floor(i / 2) * height) / 2;
    cameras.push(cam);
}
```

## Level and Vehicle Implementation

Pregenerate 10 levels as Phaser tilemaps (Tiled editor export to JSON).

-   Vehicles: Arcade physics bodies with `setDrag(0.9).setMaxVelocity(300)`.
-   Controls: `this.input.keyboard.createCursorKeys()` mapped per player; simple acceleration/brake/steer.
-   Collisions: World bounds reset vehicle; overlap with obstacles spawns particles.[3]

Load levels:

```ts
this.load.tilemapTiledJSON("level1", "assets/levels/level1.json");
this.add.tilemapTiled("level1").addTilesetImage("tiles", "tileset");
```

## Build and Optimization

Vite config (`vite.config.ts`): Enable Phaser asset hashing, base public path `/`.

```ts
export default defineConfig({
    base: "./",
    assetsInclude: ["**/*.png", "**/*.json", "**/*.mp3"],
});
```

Production build minifies JS/CSS; Phaser auto-scales for mobile/desktop. Test split-screen on 1080p+ resolutions.[1]

## Deployment Notes

Host static build on Vercel/Netlify. For fullscreen, add `phaser-plugin-fullscreen`. No backend needed for local multiplayer.[2]

## Citations

-   Vite + React + Phaser tutorial (vitejs.dev, phasereditor2d.com).[1]
-   Phaser 3 official docs (phaser.io).[2]
-   Split-screen examples (phaser.discourse.group).[3]
-   Multiplayer hot-seat implementations (github.com/phaserjs).[4]
-   Canvas camera splitting (labs.phaser.io).[5]

[1](<https://en.wikipedia.org/wiki/Micro_Machines_(video_game)>)
[2](https://www.reddit.com/r/NewStarGP/comments/17xk6w2/68_player_split_screen_support_would_make_local/)
[3](https://www.reddit.com/r/Unity3D/comments/f85r00/this_is_a_4_player_micromachine_inspired_game_i/)
[4](https://www.reddit.com/r/localmultiplayergames/comments/1fvfsvd/retro_racing_2/)
[5](https://www.microsoft.com/en-mg/p/micro-machines-racer/9nspmt9hvj3b)
