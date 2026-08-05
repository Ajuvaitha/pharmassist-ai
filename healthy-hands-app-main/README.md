# Smart Script

Build a "Smart e-Prescription" healthcare web app for doctors to create digital prescriptions on tablet/touch devices. 

TECH: React + Tailwind CSS, mobile/tablet-first responsive design, clean modern healthcare UI (soft blues/teals, high contrast, large touch targets, rounded cards).

CORE SCREENS:

1. **Doctor Login**

   - Simple email/password login screen

   - Doctor avatar, name, and specialty shown after login (mock auth is fine)

2. **Dashboard**

   - Doctor's name, today's date, list of today's patients/appointments

   - "New Prescription" primary CTA button

   - Recent prescriptions list

3. **Patient Selection**

   - Search existing patients by name/ID

   - "Register New Patient" form (name, age, gender, phone, allergies field)

   - Selected patient shows as a card at the top of the prescription flow

4. **Medicine Search & Auto-Suggest** (core feature)

   - Large search input: "Type medicine name..."

   - As the doctor types (e.g. "Amox"), show a live dropdown of matching medicines with brand names, e.g.:

     - Amoxicillin 250mg

     - Amoxicillin 500mg

     - Amoxicillin-Clavulanate 625mg

   - Use a mock local JSON array of ~30 common medicines (name, strength, form: tablet/syrup/capsule) to simulate the database

   - Tapping a suggestion selects it and moves to dosage step

5. **Dosage & Instructions**

   - Dosage form selector: Tablet / Syrup / Capsule (as pill-style toggle buttons)

   - Strength selector (e.g., 250mg / 500mg)

   - Quantity stepper (number of tablets)

   - Frequency selector: Once daily / Twice daily / Thrice daily (icon buttons)

   - Timing: Before food / After food (toggle)

   - Duration: number of days input with quick-select chips (3, 5, 7, 10 days)

   - Quick instruction template chips (multi-select): "Take after food", "Complete full course", "Drink plenty of water", "Avoid alcohol", "Take with milk"

   - "Add Medicine" button appends to the prescription list below

6. **Prescription Builder (running list)**

   - Shows all added medicines as cards (medicine name, dosage, frequency, duration, instructions) with edit/remove icons

   - "Add Another Medicine" button loops back to step 4

   - Follow-up date picker at the bottom

   - "Finalize Prescription" primary button

7. **Final e-Prescription Preview**

   - Clean printable prescription layout: clinic/doctor header, patient details, date, medicine table (name, dosage, frequency, duration, instructions), follow-up date, doctor signature area

   - Action buttons: Print, Share via WhatsApp/Email/SMS (mock buttons), Save to History

8. **Prescription History**

   - List/table of past prescriptions per patient, searchable, tap to view full prescription preview

DATA: Use mock/local state (React useState or a JSON file) for patients and medicines — no real backend needed, but structure the code so an API layer could be swapped in later.

UX DETAILS:

- Auto-suggestion dropdown should feel fast and native (debounced search, highlight matched text)

- Use a step-based flow indicator (Patient → Medicine → Dosage → Review) at the top during prescription creation

- Big tap targets and generous spacing since this is used on a tablet in a clinic setting

- Empty states and loading skeletons where relevant

Start by building the Dashboard, Patient Selection, and the Medicine Search + Auto-Suggest + Dosage flow first, since that's the core value of the app.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ed6cd21-1020-4436-b36c-2439924b3804).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
