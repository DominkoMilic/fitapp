# PACE: expert review pack

Date: 2026-11-09 · Calculation version 2.1.0 · For: a registered dietitian / sports nutritionist, a physiotherapist and a strength and conditioning (S&C) coach

PACE is a fitness coaching app for adults (18+). It isn't a medical device: it never diagnoses, never recommends training through pain and never overrides professional restrictions.

This pack lists every number and rule that affects nutrition targets, training content and injury handling, with:
- where it lives in the code
- its source
- its status:
  - **Evidence**: from a published equation or guideline
  - **Convention**: common practice, not a hard rule
  - **Placeholder**: a reasonable default chosen by the team that needs expert input

Each section ends with specific questions. The full product specification is `docs/PACE_SPEC.md` (sections 8, 9, 10, 15 and 25). Please write your answers next to each question. Changes will be made in code and recorded in `docs/decisions.md`.

---

## 1. Dietitian / sports nutritionist

### 1.1 Energy

| Item | Value | Code | Source | Status |
|---|---|---|---|---|
| BMR | Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age, +5 (male) / −161 (female) | `src/domain/calculations/energy.ts` | Mifflin et al., 1990 | Evidence |
| Sex for the equation | User chooses "male" or "female" equation (stored separately from gender identity) | `profiles.calc_sex` | — | Convention |
| Activity multipliers (include usual exercise) | 1.2 / 1.375 / 1.55 / 1.725 / 1.9 | `energy.ts` | FAO/WHO/UNU-style PAL factors | Convention |
| Exercise calories | Not added to the food budget (already in the multiplier); shown as estimates only | spec 8.10 | Avoids double counting | Convention |
| Energy per kg of body weight | 7,700 kcal/kg | `src/constants/safety.ts` | Wishnofsky (1958) | Convention, known to overestimate long-term loss (Hall et al., 2011) |
| Weekly loss rate | 0.25–1.0% of body weight per week, default 0.5%, warning above 0.75% | `safety.ts` | Common clinical guidance | Convention |
| Maximum deficit | min(desired, 750 kcal, 25% of TDEE) | `targets.ts` | — | Placeholder |
| **Maximum deficit with 4+ hard sessions a week** | **500 kcal** (new in 2.1.0) | `FREQUENT_TRAINING` | To reduce low energy availability risk (IOC REDs consensus, 2023) | Placeholder (direction evidence-based, numbers chosen by the team) |
| Surplus (build muscle) | 0.1–0.25%/week, max 300 kcal/day | `safety.ts` | Lean-gain practice | Convention |
| Safety floor | max(1,500 male / 1,200 female, BMR rounded to 10) | `safetyFloor()` | Common clinical minimums | Convention |
| Minimum target BMI | 18.5 | `safety.ts` | WHO | Evidence |
| Recalibration | Every 14 days after 21 days on target; ±100–150 kcal proposals from the weight trend and logging adherence ≥ 80%; never applied without confirmation | `src/domain/coach/recalibration.ts` | — | Placeholder |

### 1.2 Macronutrients, fibre and water

| Item | Value | Code | Source | Status |
|---|---|---|---|---|
| Protein | 1.6–2.2 g/kg, default 1.8, warning above 2.5 | `PROTEIN_G_PER_KG` | ISSN position stand (Jäger et al., 2017); Morton et al., 2018 | Evidence |
| Protein reference weight | Target weight when losing; weight at BMI 25 if BMI ≥ 30; otherwise current weight | `referenceWeight()` | — | Convention |
| Fat | 20–35% of energy, default 25% | `FAT_PCT` | AMDR (IOM) | Evidence |
| Carbohydrate | The remainder; warning below 50 g | `macroTargets()` | — | Convention |
| **Sport carbohydrate guidance** | Information note when someone plays a sport, trains 3+ times a week and carbs are under **3 g/kg** (new) | `sportCarbAdvice()` | Team-sport guidance ~3–7 g/kg (Thomas et al., ACSM/AND/DC 2016) | Evidence (lower bound only) |
| Fibre | 14 g per 1,000 kcal | `FIBRE_G_PER_1000_KCAL` | IOM | Evidence |
| Water | 35 ml/kg, limited to 1,500–4,000 ml | `WATER` | EFSA adequate intakes; ml/kg convention | Convention |
| **Training-day hydration note** | "about 500 ml extra per hour of training, more in heat" (display only) | `HYDRATION_ML_PER_TRAINING_HOUR` | Sports hydration guidance | Convention |

### 1.3 Food data and recipes

- **Foods.** USDA FoodData Central (CC0), per 100 g. Missing values stay missing ("partial data"), never zero.
- **Recipe nutrition.** Calculated from food ingredients, or entered by the user as "Your estimate". TheMealDB recipes never get invented nutrition.
- **Diet filters.** Keyword-based for vegetarian, vegan and allergens. The app always says "Always check ingredients yourself".

### 1.4 Questions for the dietitian

1. Are the activity multiplier descriptions (onboarding step 3) clear enough that people who also log games and practices don't count them twice?
2. Is 500 kcal/day a sensible maximum deficit for 4+ hard sessions a week? Should it also depend on body size or sex, or be a percentage of TDEE?
3. Should the safety floor be higher for very active people, for example based on energy availability (kcal per kg of fat-free mass), when body composition isn't known?
4. Protein 1.8 g/kg by default, with a reference weight for higher BMI: do you agree? Any age-related adjustment (≥ 65)?
5. Is a 3 g/kg carbohydrate note (information only) right, or should PACE shift the split towards carbohydrate on training days?
6. Is the water target (35 ml/kg, max 4 L) appropriate, and is the training-day note enough?
7. Should the 7,700 kcal/kg projection be replaced with a dynamic model (for example Hall's), given that projections are labelled as estimates?
8. What wording should PACE use around eating-disorder risk? (There is a disclaimer, an 18+ age limit and no "clean eating" language.)

---

## 2. Physiotherapist

### 2.1 Injury model (spec 9)

| Item | Value | Code | Status |
|---|---|---|---|
| Stages | active → recovering → cleared for training → cleared for sport → resolved; **the user sets the stage, the app never changes it** | `src/domain/training/injury.ts` | Convention |
| Body areas → restriction tags | ankle/foot: impact, jumping, lateral, sprint, ankle load, single-leg balance · calf/Achilles: impact, jumping, sprint, ankle load · knee: impact, jumping, lateral, sprint, deep knee flexion · hip/groin: lateral, sprint, deep hip flexion · hamstring: sprint, loaded hinge · lower back: spinal load, loaded hinge, impact · shoulder: overhead, loaded push · elbow/wrist/hand: wrist load, heavy grip · neck: overhead, spinal load | `AREA_RESTRICTIONS` | Placeholder |
| Recovering | Excludes impact, jumping, lateral and sprint for that area | `restrictionTagsFor()` | Placeholder |
| Cleared for training | Still excludes jumping, lateral and sprint | same | Placeholder |
| Sport while not cleared | Games and practices of a sport that loads the injured area show a caution, and the sport-skills session isn't scheduled | `sportRestrictedFor()` | Placeholder |
| Sport load areas | Lower body (ankle/foot, calf/Achilles, knee, hip/groin, hamstring) for football, futsal and running; + elbow/wrist/hand for basketball; + shoulder and elbow/wrist/hand for handball, volleyball, tennis, padel and badminton; table tennis: ankle/foot, knee, shoulder, elbow/wrist/hand; hockey: lower body + lower back + elbow/wrist/hand; water polo: shoulder, elbow/wrist/hand, neck, lower back, hip/groin, knee; swimming: shoulder, neck, lower back, elbow/wrist/hand; cycling: knee, hip/groin, lower back, neck; rugby, martial arts and "Other": all areas | `src/domain/sports/catalogue.ts` | Placeholder |
| Pain rule | Pain ≥ 4/10 in the daily check-in → coach card "You reported pain today. Rest that area and consider professional advice if it persists."; the app never suggests training through pain | spec 9.3, coach S2 | Convention |
| Return to sport | Moving to "cleared for sport" shows "We recommend clearance from a healthcare professional before returning to matches" | spec 9.1 | Convention |

### 2.2 Questions for the physiotherapist

1. Are the restriction tags per body area complete? What is missing (e.g. "kneeling", "rotation under load", "contact")?
2. Is it right that "cleared for training" still excludes jumping, lateral and sprinting until "cleared for sport"?
3. Do the sport load areas in the sports catalogue match where each sport puts stress?
4. Which drills (section 3) should be flagged for specific conditions beyond the tags (e.g. neck isometrics, overhead throws, flutter kicks for lower back)?
5. Is a weekly "How is your ankle?" prompt the right cadence for updating the injury stage?
6. Wording review: the health disclaimer, the pain rule and the return-to-sport message.

---

## 3. S&C coach

### 3.1 Weekly structure (spec 10.2)

| Rule | Value | Code | Status |
|---|---|---|---|
| Day before a game (MD-1) | Rest or 15 min mobility | `weekly-pattern.ts` | Convention (common in team sports) |
| Day after a game (MD+1) | Recovery (easy walk + mobility) | same | Convention |
| Strength spacing | ≥ 48 h between strength days when possible; lower body placed furthest from the next hard day | same | Convention |
| Rest | At least one full rest day a week | same | Convention |
| Hard-day warning | More than 4 hard days (including the sport-skills session) shows a warning | same | Placeholder |
| **Sport-skills session** | One a week (first sport's pack) when the user plays a sport, has the sport focus and trains ≥ 3 days, and isn't restricted. **Avoids two days before a game and days next to a hard practice when another day is free** (new) | same | Placeholder |
| Training load | session RPE × minutes; spike if last 7 days > 1.3 × mean of the prior 3 weeks (soft tip only) | `src/domain/coach/load.ts` | Evidence-informed (Foster session RPE; acute:chronic idea), threshold is a placeholder |
| Progression (light equipment) | Reps, then tempo, then unilateral, then pauses before adding load | spec 10.5 | Convention |

### 3.2 Sport packs (spec 25.3, `src/domain/training/catalogue.ts`)

There are 12 packs of about 30 minutes each: football/futsal, basketball, handball, volleyball, racket sports, hockey, rugby (no contact), swimming dryland, combat (no sparring), running, cycling and general athletic. There are 31 sport drills, each with a caution line and contraindication tags. Every pack still works with no equipment.

**New dynamic warm-up (RAMP),** about 8–10 minutes:
- **Field and court packs:** march or easy jog in place (2 min) → leg swings 10/side → lateral lunge 6/side → walking knee hug 6/side → arm circles 45 s → 2–3 build-up runs to about 70% (swapped for marching when impact or sprint is restricted).
- **Swimming and cycling packs:** march, arm circles, leg swings, cat-cow (no running).

**Dosage rules (checked by automated tests):**
- Sprint, change-of-direction and approach drills: **≥ 90 s rest** between sets.
- Jumping drills: **≤ 30 foot contacts per pack** (lateral bounds and skater jumps reduced to 2 × 6 per side).
- No contact, tackling or sparring drills anywhere.

### 3.3 Sign-off checklist for drill content

For each of the 12 packs, please confirm or correct the following.

| Pack | Warm-up suitable | Drill selection | Sets × reps / time | Rest | Cautions and contraindication tags | Alternatives when equipment is missing or a drill is restricted | Signed off |
|---|---|---|---|---|---|---|---|
| Football & futsal | | | | | | | |
| Basketball | | | | | | | |
| Handball | | | | | | | |
| Volleyball | | | | | | | |
| Racket sports | | | | | | | |
| Hockey | | | | | | | |
| Rugby (no contact) | | | | | | | |
| Swimming dryland | | | | | | | |
| Combat (no sparring) | | | | | | | |
| Running | | | | | | | |
| Cycling | | | | | | | |
| General athletic | | | | | | | |

### 3.4 Questions for the S&C coach

1. Is one sport-skills session a week the right default, and is it in the right place relative to games and practices?
2. Should strength sessions change in-season compared with off-season (e.g. lower volume in game weeks)?
3. Are the jump-volume cap (30 contacts) and sprint rest (90 s) appropriate for adult recreational players?
4. Is "> 4 hard days" the right threshold for the hard-day warning?
5. MET values per sport (games/practices) in `src/domain/sports/catalogue.ts` come from the 2024 Adult Compendium. Please confirm the mapping of each sport to a Compendium activity.

---

## 4. What changed in this pass (2026-11-09)

- **Nutrition:**
  - calculation version 2.1.0
  - 500 kcal deficit cap for 4+ hard sessions a week
  - sport carbohydrate note (3 g/kg)
  - training-day hydration note

  When no training is known, all published test vectors (spec 29) are unchanged.
- **Training:**
  - RAMP warm-up in every sport pack
  - ≥ 90 s rest for sprint, change-of-direction and approach work
  - ≤ 30 jump contacts per pack
  - better placement of the sport-skills session
  - drills count towards the hard-day warning
- **Nutrition can be switched off.** The safety rules still apply to the stored targets.
