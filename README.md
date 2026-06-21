# Fossil Fighters Champions — Online Battle (Proof of Concept)

This is a minimal multiplayer demo. Two players connect, pick moves, and deal
damage to each other's vivosaur. The goal is just to prove the online part works
before building real game logic.

---

## STEP 1 — Install Node.js (do this once, ever)

1. Go to https://nodejs.org
2. Click the big green **"LTS"** button (the one that says "Recommended for most users")
3. Download and run the installer — click Next on everything, defaults are fine
4. When it finishes, open a terminal:
   - **Windows**: press Win+R, type `cmd`, press Enter
   - **Mac**: press Cmd+Space, type `Terminal`, press Enter
5. Type this and press Enter to confirm it worked:
   ```
   node --version
   ```
   You should see something like `v20.11.0`. If you do, Node is installed! ✅

---

## STEP 2 — Run it on YOUR computer first (local testing)

1. Put the `fossil-fighters-poc` folder somewhere easy to find (like your Desktop)
2. Open a terminal and navigate to that folder:
   ```
   cd Desktop/fossil-fighters-poc
   ```
   (On Mac/Linux use forward slashes; on Windows you can also just type `cd ` then
   drag the folder into the terminal window)
3. Install the dependencies (only need to do this once):
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
   You should see: `Fossil Fighters server running on port 3000`
5. Open your browser and go to: **http://localhost:3000**
6. Open a **second tab** also at http://localhost:3000
7. Enter a name in each tab and click "Find Opponent" — they should connect and battle!

To stop the server: press **Ctrl+C** in the terminal.

---

## STEP 3 — Put it online with Render (free)

1. Create a free account at https://github.com — you need this to use Render
2. Create a new repository on GitHub called `fossil-fighters-poc`
3. Upload all the files in this folder to that repository
   (GitHub has a drag-and-drop upload on the website — no command line needed)
4. Create a free account at https://render.com
5. Click **New → Web Service**
6. Connect your GitHub account and pick your `fossil-fighters-poc` repository
7. Render auto-detects the settings from `render.yaml` — just click **Create Web Service**
8. Wait 2–3 minutes for it to deploy
9. Render gives you a URL like `https://fossil-fighters-poc.onrender.com`
10. Share that URL with a friend and battle! 🦕

**Note:** On Render's free tier, the server sleeps after 15 minutes of no activity.
The first person to visit after it's been idle will wait ~30 seconds for it to wake up.
That's normal and fine for testing.

---

## What this demo does

- Two players enter their name and click "Find Opponent"
- They're matched together automatically
- They take turns picking from 4 moves (Fossil Cannon, Stone Stomp, Dino Rush, Ancient Roar)
- HP bars update in real time for both players
- When one vivosaur reaches 0 HP, the battle ends

## What this demo does NOT do (yet — future features)

- Real vivosaur roster from Fossil Fighters Champions
- Actual FFC move stats and type matchups
- Turn timer
- Player accounts / login
- Win/loss records
- More than 2 players at once

---

## File structure

```
fossil-fighters-poc/
├── server.js        ← The server (handles matchmaking and relaying moves)
├── package.json     ← Project config (lists the libraries we use)
├── render.yaml      ← Tells Render how to deploy this
└── public/
    └── index.html   ← Everything the player sees in their browser
```
