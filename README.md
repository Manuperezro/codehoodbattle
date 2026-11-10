# PYTHON CODE ARENA

**Fix the Code. Beat the Bugs. Become a Python Champion!**

An interactive, multiplayer educational Python coding game built for **Gateway Qualifications Level 2 Computer Programming (Unit T/618/3703)** students in the UK.

Unlike multiple-choice quiz platforms, students interact directly with Python code across **6 reusable minigame engines**, **7 themed curriculum worlds**, and **30 full coding challenges** covering Weeks 1–7 of introductory Python.

---

## Key Features

- **Guided Python Code Editor**: Line numbers, syntax highlighting, locked vs. editable lines, indentation controls (`+4 Spaces` / `-4 Spaces`), `Reset Code`, `Check Code`, progressive 3-step hints, and a safe deterministic Python 3 terminal simulator (no `eval()`).
- **6 Interactive Minigame Engines**:
  1. **Bug Hunter** — Repair broken Python lines directly.
  2. **Code Builder** — Drag-and-drop or use keyboard buttons (`Move Up` / `Move Down`) to arrange shuffled code blocks.
  3. **Missing Code** — Complete missing operators, `int()`/`float()` conversions, `elif` keywords and loop variables.
  4. **Predict the Output** — Trace variables and `print()` statements to predict terminal output.
  5. **Robot Programmer** — Guide Robo-Py across a 2D obstacle grid using `for` loops and game-specific movement commands.
  6. **Final Boss** — Repair complete multi-branch and loop programs (*Decision Boss*, *Cinema Ticket Machine*, *Treasure Hunt*, *Guess the Number*).
- **Mode A — Practice Arena**: Self-paced progression across all 30 challenges, 1–3 star ratings, XP rewards, and a Student Progress Report highlighting strongest topics and recommended practice areas.
- **Mode B — Live Championship**: Kahoot-style 6-digit Game PIN + nickname entry (zero personal data collected), anonymous session reconnection, classroom projector Teacher Dashboard, and live podium leaderboard.
- **Local Demo Mode Built-In**: Works out-of-the-box before Supabase is configured with clearly labelled sample data (Demo Game PIN: `483921`).

---

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (runs in **Local Demo Mode** automatically if `.env` is not configured):
   ```bash
   npm run dev
   ```
3. Run the automated test suite (tests all 30 challenges, equivalent solutions, scoring rules, and nickname validation):
   ```bash
   npm test
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## Setting Up Supabase for Live Multi-Device Classroom Championships

1. **Create a Free Supabase Project**:
   - Sign in at [https://supabase.com](https://supabase.com) and create a new project.
2. **Run the SQL Migration**:
   - Open the **SQL Editor** in your Supabase dashboard.
   - Copy and run the contents of [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
   - This creates `teacher_profiles`, `challenge_catalogue`, `game_sessions`, `session_players`, `challenge_attempts`, `scores`, Row Level Security (RLS) policies, and Realtime publications.
3. **Enable Anonymous Sign-Ins (for Student PIN Joining)**:
   - In Supabase Dashboard → **Authentication** → **Providers** → **Anonymous Sign-Ins**, toggle **Enable Anonymous Sign-ins** ON.
4. **Provision Your First Teacher Account Securely**:
   - In Supabase Dashboard → **Authentication** → **Users**, click **Add User** → **Create New User** and enter your lecturer email and password.
   - Copy the generated User `UUID`, then run this SQL in the Supabase **SQL Editor**:
     ```sql
     insert into public.teacher_profiles (id, display_name)
     values ('YOUR-LECTURER-USER-UUID-HERE', 'Course Lecturer');
     ```
   - Teacher permissions are verified server-side via RLS (`public.is_verified_teacher()`).
5. **Deploy the Server-Side Validation Edge Function**:
   - Deploy [`supabase/functions/validate-submission/index.ts`](./supabase/functions/validate-submission/index.ts) using the Supabase CLI:
     ```bash
     supabase functions deploy validate-submission
     ```
6. **Configure Local `.env`**:
   - Copy `.env.example` to `.env` and fill in your public project URL and anon key:
     ```env
     VITE_SUPABASE_URL=https://your-project-id.supabase.co
     VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
     ```

---

## Step-by-Step GitHub Pages Deployment Guide

1. **Create a GitHub Repository**:
   - Create a new repository on GitHub (e.g. `CodeHootBattle` or `python-code-arena`).
2. **Upload the Project**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Python Code Arena"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
3. **Configure GitHub Pages to Use GitHub Actions**:
   - On GitHub, open your repository → **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. **Add Supabase Public Configuration Values (Optional for Live Mode)**:
   - Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.
   - Add repository variables (never commit secret service-role keys to frontend builds):
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase publishable anon key
5. **Deploy the Frontend**:
   - Push to `main` or open the **Actions** tab and click **Run workflow** on **Deploy Python Code Arena to GitHub Pages**.
   - The workflow automatically sets `VITE_BASE_PATH=/<your-repo-name>/`, runs all unit tests, builds `./dist`, and deploys.
6. **Test the Public URL**:
   - Open `https://<your-username>.github.io/<your-repo-name>/` in your browser!

