# Teacher test maker manual

**Audience:** Teachers using Second Teacher; frontend can embed or link this from the assessment editor.  
**Companion:** [`teacher-demo-frontend-focus.md`](./teacher-demo-frontend-focus.md)  
**API:** Draft/items/publish in [`api-for-frontend.md`](./api-for-frontend.md).

---

## 1. Why consistency matters

Items are analyzed for **class analytics**, **at-risk signals**, and the **what-if predictor**. If topics and difficulty are applied unevenly, charts and forecasts drift. Use the same **topic labels** and **difficulty scale** across all assessments in a subject.

---

## 2. Assessment naming (until types are in the API)

The backend currently exposes `title` only. Encode the assessment kind in the title so filters and charts can group results:

| Prefix in title | Use for |
|-----------------|--------|
| `Practice:` | Low-stakes repetition, unlimited attempts if policy allows |
| `Quiz:` | Short checks, frequent |
| `Test:` | Graded or higher-stakes |
| `Exam:` | Summative, longer window |

Example: `Test: Chapter 4 — Linear equations`.

---

## 3. Building each item

- **Stem:** One clear question; avoid double negatives.
- **Options:** At least two keys in `options`; exactly one `correctKey`.
- **Length:** Prefer similar reading length across options to reduce guessing cues.

When the UI offers **topic** and **difficulty** fields, fill them for **every** item. If the API does not yet store them, follow the product-chosen interim convention (e.g. UI-only draft tags) and avoid embedding fake metadata in stems unless product approves.

---

## 4. Topic tags

- Use a **small controlled set** per subject (e.g. `Algebra: linear`, `Algebra: quadratics`, `Geometry: triangles`).
- Do not invent one-off synonyms for the same idea; synonyms break aggregation.
- Map textbook chapters to topics in a planning doc if needed; the **predictor** will look for **historical performance on the same topic labels**.

---

## 5. Difficulty scale

Use the scale your school adopts in the product (commonly **Low / Medium / High** or **1–3**):

| Level | Guidance |
|-------|----------|
| Low | Recall, single-step, familiar context |
| Medium | Multi-step, standard exam style |
| High | Novel context, synthesis, or time pressure |

Mix should match the real exam you are preparing for; the **what-if** tool uses the mix to estimate strain on the class.

---

## 6. Scheduling windows

- Publish uses **UTC** instants plus a **timezone label** (`windowTimezone`) for display.
- For “same calendar day only,” set open and close on that day in the chosen zone (product may add a dedicated mode later).
- Communicate the window to students outside the app if they do not see notifications yet.

---

## 7. After publish

- Trigger **analytics recompute** when the product provides a control (e.g. after a large batch of attempts).
- Review **insights** and **notifications** for at-risk students and weak patterns.
- Open **group analytics** and **student profiles** for trends; topic breakdowns appear when items are tagged and attempt data is exposed to teachers.

---

## 8. Using the what-if predictor

1. **Align inputs** with how past assessments were tagged (topics + difficulty).
2. **Require enough history:** forecasts are weak until several tagged attempts exist per topic; expect “insufficient data” states in the UI.
3. **Interpret output** as **planning aid**, not a guarantee; use it to adjust difficulty mix or add remediation before the real exam.

---

## 9. Quick checklist before publish

- [ ] Title reflects **Practice / Quiz / Test / Exam** convention.
- [ ] Every item has **topic** (and **difficulty** when supported).
- [ ] Options and `correctKey` verified.
- [ ] Window matches intended local date/time for students.
- [ ] You know where to find **insights** and **risk** after attempts are in.

---

*End of manual.*
