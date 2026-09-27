const STORAGE_KEY = "monthlyKinderPromptBuilder:v2";

const defaultStudents = Array.from(
  { length: 19 },
  (_, index) => `Alumno ${String(index + 1).padStart(2, "0")}`,
);

const defaultTraits = [
  "Recuperación de saberes previos e identificación de necesidades del grupo.",
  "Planeación de acciones, acuerdos y recursos necesarios para el proyecto.",
  "Desarrollo de actividades centrales con participacion activa del grupo.",
  "Socializacion de avances, producciones y experiencias del proyecto.",
  "Reflexión, cierre y evaluación de los aprendizajes logrados.",
];

const fieldIds = [
  "lastFileName",
  "previousMonth",
  "newMonth",
  "previousMethodology",
  "newMethodology",
  "activityDocs",
  "dateRange",
  "groupName",
  "specialDates",
  "orderTrait",
  "traitSingular",
  "traitPlural",
  "formativeField",
  "axis",
  "content",
  "pda",
  "graduateProfile",
  "assessmentType",
  "rubricDocument",
  "students",
];

const dom = {
  form: document.querySelector("#promptForm"),
  traitList: document.querySelector("#traitList"),
  addTraitButton: document.querySelector("#addTraitButton"),
  resetTraitsButton: document.querySelector("#resetTraitsButton"),
  restoreStudentsButton: document.querySelector("#restoreStudentsButton"),
  downloadStudentsButton: document.querySelector("#downloadStudentsButton"),
  studentFile: document.querySelector("#studentFile"),
  promptOutput: document.querySelector("#promptOutput"),
  copyButton: document.querySelector("#copyButton"),
  downloadPromptButton: document.querySelector("#downloadPromptButton"),
  saveStatus: document.querySelector("#saveStatus"),
  wordCount: document.querySelector("#wordCount"),
  studentCount: document.querySelector("#studentCount"),
};

let traits = [...defaultTraits];
let statusTimer;

function getField(id) {
  return document.querySelector(`#${id}`);
}

function getValue(id) {
  return getField(id).value.trim();
}

function setStatus(message) {
  dom.saveStatus.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    dom.saveStatus.textContent = "Listo para editar";
  }, 2200);
}

function cleanLine(line) {
  return line.replace(/^\s*[-*•]\s*/, "").trim();
}

function linesFrom(text) {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
}

function valueOr(id, fallback) {
  return getValue(id) || fallback;
}

function asBullets(lines, fallback) {
  if (!lines.length) {
    return `- ${fallback}`;
  }

  return lines.map((line) => `- ${line}`).join("\n");
}

function sentenceCase(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeFilenamePart(text) {
  return (text || "proyecto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function serialize() {
  const fields = {};
  fieldIds.forEach((id) => {
    fields[id] = getField(id).value;
  });

  return { fields, traits };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
  } catch {
    return;
  }
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored) return false;

    Object.entries(stored.fields || {}).forEach(([id, value]) => {
      const field = getField(id);
      if (field) field.value = value;
    });

    if (Array.isArray(stored.traits) && stored.traits.length) {
      traits = stored.traits.map(String);
    }

    return true;
  } catch {
    return false;
  }
}

function renderTraits() {
  dom.traitList.innerHTML = "";

  traits.forEach((trait, index) => {
    const row = document.createElement("div");
    row.className = "trait-row";

    const number = document.createElement("div");
    number.className = "trait-number";
    number.textContent = String(index + 1);

    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.value = trait;
    textarea.placeholder = "Descripción del rasgo";
    textarea.setAttribute("aria-label", `Descripción del rasgo ${index + 1}`);
    textarea.addEventListener("input", () => {
      traits[index] = textarea.value;
      updatePrompt();
    });

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "X";
    removeButton.title = "Quitar rasgo";
    removeButton.setAttribute("aria-label", `Quitar rasgo ${index + 1}`);
    removeButton.addEventListener("click", () => {
      traits.splice(index, 1);
      renderTraits();
      updatePrompt("Rasgo eliminado");
    });

    row.append(number, textarea, removeButton);
    dom.traitList.append(row);
  });
}

function buildTraitBlock() {
  const traitSingular = valueOr("traitSingular", "[NOMBRE DE RASGO EN SINGULAR]");
  const traitPlural = valueOr("traitPlural", "[NOMBRE DE RASGO EN PLURAL]");
  const traitCount = traits.length || "[NUMERO DE RASGOS]";
  const lastTrait = traits.length || "[ULTIMO NUMERO DE RASGO]";
  const traitLines = traits.length
    ? traits.map((trait, index) => `\t- ${index + 1}. ${trait.trim() || "[DESCRIPCIÓN DE RASGO]"}`).join("\n")
    : "\t- [RASGO NO. DESCRIPCIÓN DE RASGO]";

  return `- ${valueOr("orderTrait", "[RASGO PARA ORDENAR]")}: son ${traitCount} ${traitPlural}, tú vas a decidir cuántos días abarca cada ${traitSingular}, se empieza por la 1 y se termina en la ${lastTrait}. Los ${traitPlural} son:\n${traitLines}`;
}

function buildSpecialDatesBlock() {
  const lines = linesFrom(getValue("specialDates"));

  if (!lines.length) {
    return ", y de los días [FECHAS ESPECIALES] vas a tomar en cuenta que se va a hacer [DESCRIPCIÓN DE LA TEMÁTICA ESPECIAL DE CADA DÍA], así que vas a hacer actividades relacionadas a esto.";
  }

  return `. Para las fechas especiales, toma en cuenta lo siguiente:\n${asBullets(lines)}\nAsí que vas a hacer actividades relacionadas con esto.`;
}

function buildAssessmentBlock(assessmentType) {
  const rubricDocument = valueOr("rubricDocument", "[NOMBRE DEL DOCUMENTO DE LA RÚBRICA]");

  return `- Después de la portada, cada día tiene que estar en una página. En seguida de eso, elabora una ${assessmentType} tomando en cuenta el Contenido y el Proceso de Desarrollo de Aprendizaje del proyecto, esta debe servir para evaluar el proyecto. Utiliza el documento ${rubricDocument}, en este se encuentra la plantilla, toma todos los datos de ahí para que la completes, los alumnos a los que se van a evaluar son los siguientes:`;
}

function buildPrompt() {
  const docs = linesFrom(getValue("activityDocs"));
  const students = linesFrom(getValue("students"));
  const assessmentType = valueOr("assessmentType", "[ELEGIR RÚBRICA O LISTA DE COTEJO]");
  const groupName = valueOr("groupName", "[GRUPO]");

  return `Este archivo (${valueOr("lastFileName", "[NOMBRE DEL ARCHIVO DEL ÚLTIMO PROYECTO].docx")}) es el proyecto que utilicé para el mes de ${valueOr("previousMonth", "[MES]")} 2026, quiero que tomes todos los elementos a manera de formato para desarrollar ahora el proyecto de ${valueOr("newMonth", "[MES]")} 2026 (me puedes regresar el documento en Word). Ese proyecto está hecho para la ${valueOr("previousMethodology", "[METODOLOGÍA DEL PROYECTO ANTERIOR]")}, pero ahora quiero utilizar la metodología de ${valueOr("newMethodology", "[METODOLOGÍA NUEVA A USAR EN ESTE PROYECTO]")}. Los documentos adjuntos:
${asBullets(docs, "[LISTA DE DOCUMENTOS CON ACTIVIDADES]")}
Contienen las actividades que se van a llevar a cabo en las siguientes fechas del 2026: ${valueOr("dateRange", "[RANGO DE FECHAS PARA EL PROYECTO]")}${buildSpecialDatesBlock()}

Quiero que tomes las actividades de los documentos antes mencionados y las ordenes por:
${buildTraitBlock()}
- Día: ejemplo: Lunes, 13 de abril de 2026, pero con todos los días que te dije.
- Actividades: En el documento ya vienen, vienen por inicio, desarrollo y cierre, tú les vas a quitar esa separación y me vas a dar las actividades de cada día separadas por viñetas.
- Recursos: la lista de recursos necesarios para realizar la totalidad de actividades de cada día (también viene en el documento adjunto).
- Notas a tomar en cuenta:
\t- No repitas las actividades, cada día es único y las actividades ya vienen en los documentos adjuntos, TÓMALAS DE AHÍ.
\t- Las fases tienen que abarcar todo el rango de fechas, por lo que no debes usar todas las fases en una semana, sino distribuirlas adecuadamente, por lo que cierto rango de días tendrá la misma fase, y eso está bien.
\t- No menciones nada de los anexos.
\t- No incluyas enlaces de YouTube ni de ninguna página.
\t- En lugar de ficha de trabajo, que diga hoja de trabajo (si se menciona).
\t- Borra los autores (por ejemplo autores de cuentos), solo deja el título.
\t- Borra cualquier mención del libro jugar e imaginar.
\t- Cambia las menciones de "la unidad" por "el proyecto" (si aparece).
\t- No incluyas términos en inglés ni anglicismos.
\t- Devuélveme el archivo .docx con todos los días mencionados anteriormente, tómate el tiempo necesario, no importa que te tardes mucho.
\t- La primera página debe ser la portada, igual pero con los datos actualizados (para ello, busca información en internet si es necesario, tiene que ser de acuerdo a la Nueva Escuela Mexicana).
\t- El nombre, la justificación de la metodología, problemática (menciona el grupo de ${groupName}), tiempo (basándote en los días, expresado en semanas) y propósito tú invéntalos basándote en toda la información siguiente:
\t\t- El campo formativo es: ${valueOr("formativeField", "[INSERTAR CAMPO FORMATIVO]")}
\t\t- El contenido es: ${valueOr("content", "[INSERTAR CONTENIDO]")}
\t\t- El Proceso de Desarrollo de Aprendizaje (PDA) es: ${valueOr("pda", "[INSERTAR PDA]")}
\t\t- El eje articulador es: ${valueOr("axis", "[INSERTAR EJE ARTICULADOR]")}
\t\t- Perfil de egreso: ${valueOr("graduateProfile", "[INSERTAR EL RASGO ADECUADO]")}
${buildAssessmentBlock(assessmentType)}
${asBullets(students, "[LISTA DE ALUMNOS]")}`;
}

function updateCounters(prompt) {
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const students = linesFrom(getValue("students")).length;
  dom.wordCount.textContent = `${words} ${words === 1 ? "palabra" : "palabras"}`;
  dom.studentCount.textContent = `${students} ${students === 1 ? "alumno" : "alumnos"}`;
}

function updatePrompt(message = "Cambios guardados") {
  const prompt = buildPrompt();
  dom.promptOutput.value = prompt;
  updateCounters(prompt);
  saveState();
  setStatus(message);
}

async function copyPrompt() {
  const text = dom.promptOutput.value;

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Prompt copiado");
  } catch {
    dom.promptOutput.focus();
    dom.promptOutput.select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    setStatus("Prompt copiado");
  }
}

function restoreDefaultStudents() {
  getField("students").value = defaultStudents.join("\n");
  updatePrompt("Lista restaurada");
}

function setupEvents() {
  fieldIds.forEach((id) => {
    getField(id).addEventListener("input", () => updatePrompt());
  });

  dom.addTraitButton.addEventListener("click", () => {
    traits.push("");
    renderTraits();
    updatePrompt("Rasgo agregado");
    const lastTextarea = dom.traitList.querySelector(".trait-row:last-child textarea");
    if (lastTextarea) lastTextarea.focus();
  });

  dom.resetTraitsButton.addEventListener("click", () => {
    traits = [...defaultTraits];
    renderTraits();
    updatePrompt("Rasgos restaurados");
  });

  dom.restoreStudentsButton.addEventListener("click", restoreDefaultStudents);

  dom.downloadStudentsButton.addEventListener("click", () => {
    const students = linesFrom(getValue("students")).join("\n");
    downloadText("lista-alumnos.txt", students || defaultStudents.join("\n"));
    setStatus("Lista descargada");
  });

  dom.studentFile.addEventListener("change", () => {
    const [file] = dom.studentFile.files;
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      getField("students").value = linesFrom(String(reader.result || "")).join("\n");
      dom.studentFile.value = "";
      updatePrompt("Lista importada");
    });
    reader.readAsText(file, "utf-8");
  });

  dom.copyButton.addEventListener("click", copyPrompt);

  dom.downloadPromptButton.addEventListener("click", () => {
    const month = normalizeFilenamePart(getValue("newMonth"));
    downloadText(`prompt-${month || "proyecto"}-2026.txt`, dom.promptOutput.value);
    setStatus("Prompt descargado");
  });
}

function init() {
  const hasStoredState = loadState();

  if (!hasStoredState) {
    getField("students").value = defaultStudents.join("\n");
    getField("orderTrait").value = "Fases";
    getField("traitSingular").value = "fase";
    getField("traitPlural").value = "fases";
  }

  renderTraits();
  setupEvents();
  updatePrompt("Listo para editar");
}

init();
