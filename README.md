# 🚇 Budapest Metro Builder — Web Game

![Budapest Metro Builder gameplay](previewForBudapestMetro.png)

Build the Budapest metro one section at a time. Draw cards, connect stations, and complete lines — without breaking placement rules. It’s part strategy, part spatial puzzle, and very Budapest.

---

## 🎮 Gameplay

You’re constructing metro lines by placing valid track sections between stations. Each turn you draw a card that determines what kind of connection you’re allowed to build.

**Goal:** finish each metro line in order, using the smartest routes possible.

---

## 🕹 Controls

- **Start:** Enter your name → click **Start**
- **Draw card:** press **Draw card** to reveal a symbol (**A / B / C / D / ★ Joker**)
- **Build section:**
  1. Click an **origin** station  
  2. Click a **target** station that matches the drawn card
- **Skip:** **Next card** draws without building
- **End round:** a round ends after **8 cards total**, or when the **5th side/center card** is drawn.  
  At that point you can no longer draw and must press **End round**.

---

## 📌 Placement Rules

- The **first section** must start from the line’s designated **start station**.
- Next sections must start from an **endpoint** of that line.
- Tracks can only be **straight** or **45° diagonal**.
- **No passing through other stations**; **no crossing existing segments**  
  *(except at the special “?” station, if applicable in your map)*.
- **No duplicate segments** between the same pair of stations.
- **Joker (★):** matches **any** symbol.
- **“?” station:** accepts **any** card.

---

## ✨ Features

- Card-driven metro building (luck + planning)
- Rule checks prevent illegal segments
- Round-based pacing
- Runs instantly in the browser

---

## 🛠 Tech Stack

- Web app (HTML / CSS / JavaScript)
- Interactive 2D map UI
- Game-state + rules engine
---
