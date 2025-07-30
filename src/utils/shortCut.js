import { Undo, Redo, clearAllMasks, endTask } from "./maskingManager.js";
import { saveMaskedPdf } from "./pdfExportManager.js";
import { runAllOCR } from "./pdfOcr.js";
import { getPdfDoc } from "./pdfViewer.js";
import { hideElement, showElement } from "./domHelpers.js";

document.addEventListener("keydown", (event) => {
  const activeId = document.activeElement.id;

  // 입력받는 곳은 keydown event 제외
  if (
    activeId === "extract-pages" ||
    activeId === "regex-key" ||
    activeId === "regex-value"
  )
    return;

  if (!event.ctrlKey) return;

  const pdfDoc = getPdfDoc();
  if (!(event.code === "KeyO" || pdfDoc)) return;

  event.preventDefault();

  switch (event.code) {
    case "KeyO":
      document.getElementById("open-pdf-label").click();
      break;
    case "KeyS":
      saveMaskedPdf();
      break;
    case "KeyZ":
      Undo();
      break;
    case "KeyY":
      Redo();
      break;
    case "KeyR":
      clearAllMasks();
      endTask();
      break;
    case "KeyF":
      runAllOCR();
      break;
    case "KeyE":
      hideElement(document.getElementById("wrapper-edit"));
      showElement(document.getElementById("extract-modal"));
      break;
  }
});
