# Monthly Kinder Prompt Planner

A minimal school-style web page for generating reusable prompts for monthly kindergarten project planning.

The tool helps teachers fill in project details step by step, preview the final prompt live, copy it to the clipboard, and download it as a `.txt` file. It also includes a student list editor with TXT import and export support.

## Features

- Ordered form for project file, month, methodology, dates, activities, curriculum data, and assessment type.
- Live prompt preview that updates as the form changes.
- Copy generated prompt to the clipboard.
- Download generated prompt as a TXT file.
- Preloaded student list example.
- Import an existing student list from TXT.
- Download the edited student list as TXT.
- Minimal school-inspired responsive design.
- No build step or server required.

## How to Use

Open `index.html` in any modern web browser.

Fill in the project fields from top to bottom. The generated prompt appears on the right side of the page on desktop and below the form on smaller screens.

## Project Files

- `index.html` contains the page structure.
- `styles.css` contains the visual design and responsive layout.
- `script.js` contains prompt generation, local saving, copy, download, and TXT import/export logic.

## Notes

The form saves progress in the browser using `localStorage`, so edits remain available after refreshing the page on the same device and browser.
