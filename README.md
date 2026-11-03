# GAME ON V1

A 2D browser game with animation, a bit of data, and some math. It runs in any web browser with nothing to install.

## Tech stack

- **HTML, CSS, JavaScript**: plain web technologies, no install needed.
- **HTML Canvas**: draws and animates sprites, shapes, and effects at 60 frames per second.
- **Math in JavaScript**: movement, physics (gravity, bouncing), collision detection, angles, scoring formulas, random level generation.
- **Data**: game settings, levels, and stats in JSON. High scores and progress are saved in the browser (`localStorage`). An online database can be added later for shared leaderboards.
- **Libraries (optional)**: something like Phaser only if the game needs it. Plain JavaScript is usually simpler for a moderately complex game.

## GitHub setup

- **Git**: version history, pushed to this repository.
- **GitHub Pages** (free): hosts the game at `https://wahhajahkam-bit.github.io/GAME-ON-V1` so anyone can play it.
- **GitHub CLI (`gh`)** (optional): for turning on Pages or making releases from the command line.

## Development steps

1. **Agree on the design**: rules, controls, win/lose conditions, and the math involved.
2. **Basic setup**: `index.html`, a game loop, keyboard/mouse/touch input, and a canvas that resizes to the screen.
3. **Core gameplay**: player movement, game objects, collisions, and the main math. *(First playable version for feedback.)*
4. **Data**: scores, levels, settings, and saving.
5. **Animation and polish**: sprite animation, transitions, particles, sound, and menus.
6. **Testing**: play-testing in the browser, bug fixes, and checks on phone-sized screens.
7. **Publish**: commit, push, turn on GitHub Pages, and share the playable link.
