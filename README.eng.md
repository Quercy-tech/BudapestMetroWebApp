Student's name: Oleksii Hezha
Student's Neptun code: JJYUA3

This solution was submitted and created by the student named above for the "JavaScript home assignment" assessment of the Web Programming course.

I hereby declare that this solution is my own work. I have not copied or used solutions from third parties. I did not forward my solution to other students, nor did I publish it anywhere. I understand that According to Section Section 377/A of ELTE Academic Regulations for Students, I will not be able complete the subject if I use an any disallowed aid or provide unauthorised assistance to another student.

ELTE Academic Regulations for Students, Regulations on the Faculty of Informatics, Section 377/A: "A student who uses aids other than those specified by the instructor or provides unauthorised assistance to another student during an evaluation (exam, test, homework assignment) requiring the preparation of a computer programme or programme module is in violation of the academic rules, and shall not be permitted to complete the subject in the given semester and therefore shall not obtain the credit awarded for the subject."

Budapest, 2025

## Self-scoring

Mark all completed tasks with [X] symbol. Reminder: all minimum requirements MUST be completed, otherwise the home assignment will be rejected.

### Minimum Requirements (without these, submission will not be accepted – 8 points)

- **Environment**
  - [X] The README.eng.md file in the starter package is filled out (declaration, self-scoring).
  - [X] The game is created without using any JavaScript frameworks.
  - [X] The solution fully avoids the practices listed under the bad practice section.
- **Menu**
  - [X] In the main menu, the player can enter their name before starting a new game.
  - [X] Clicking the Start button navigates to the game screen.
  - [X] The menu provides access to a description of the game's rules, especially regarding controls (e.g. how to draw a section: drag/clicking/arrows...).
- **Game**
  - [X] On the game screen, the player’s name is displayed, along with a timer updating every second, and the name/color of the current metro line being constructed.
  - [X] The board and station locations are rendered on the game screen.
  - [X] A section can be drawn between two stations, following the grid rules (either 90° or 45° angles).

### Core Tasks (12 points)

- **Cards (1.5 points)**
  - [X] 0.5 points: A random station card can be drawn from the deck (including the ability to draw the next card without drawing on the board).
  - [X] 0.5 points: The deck contains only the specified cards (A-B-C-D-Joker for middle platforms and A-B-C-D-Joker for side platforms).
  - [X] 0.5 points: The Joker card functions correctly.
- **Building segments (5.5 points)**
  - [X] 0.5 points: Segments can only be drawn from the current metro line's end to the station indicated on the current card.
  - [X] 0.5 points: Joker station works correctly.
  - [X] 1.0 point: Segments cannot intersect.
  - [X] 0.5 points: Parallel segments are not allowed (only one segment between any two stations).
  - [X] 0.5 points: A segment cannot lead to a station already visited by the same metro line (no loops).
  - [X] 1.0 point: Sections cannot pass through other stations (each section touches exactly two stations).
  - [X] 1.5 points: Sections can also be built diagonally at 45° angles.
- **Rounds (1.5 points)**
  - [X] 0.5 points: The order of rounds (colors/metro lines) is pre-generated and displayed (we can see the current round).
  - [X] 1.0 point: After the 8th card is drawn, the round ends and a new line/color begins.
    - [X] _Or for 0.5 partial points: A button allows manual transition to the next round at any time (starts new metro line/color)._
- **Scoring (3.5 points)**
  - Round scoring works
    - [X] 0.5 points: Number of districts covered (PK)
    - [X] 0.5 points: Maximum number of stations in a single district (PM)
    - [X] 0.5 points: Number of Danube crossings (PD)
    - [X] 0.5 points: Round score FP = (PK × PM) + PD
    - [X] _Or for 0.5 partial points: If the above cannot be implemented, partial points may be awarded if the round score equals the number of stations covered._
  - Game scoring works
    - [X] 0.5 points: Junctions — how many stations are visited by two lines (P2), three lines (P3), or four lines (P4)
    - [X] 0.5 points: Points for visiting train stations are shown on a "slider" during gameplay (PP)
    - [X] 0.5 points: Final Score = Sum(FP) + (PP) + (2 × P2) + (5 × P3) + (9 × P4)

### Extra Tasks (5 points)

- [X] 0.5 points: Alternative round-ending condition: There are two types of station cards (side platform and central platform). If the fifth card of either type is drawn, no more cards can be drawn — instead, a "End Round" button must be pressed.
- [X] 1.0 point: At the end of the game, the player's name, score, and completion time are saved (in local storage), and results can be viewed in the menu in descending order of score.
- [] 1.5 points: The switch card functions properly.
- [] 2.0 points: Pencil abilities (see Gameplay > Extra task: New Game Mode.

