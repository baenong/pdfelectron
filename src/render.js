import {
  setupPdfLoading,
  initializePdfViewer,
  getCurrentPageNum,
  getPdfDoc,
  setInitialMaskColor,
} from "./utils/pdfViewer.js";
import { setupPageNavigation } from "./utils/pageNavigation.js";
import {
  displayWorkingModal,
  hideWorkingModal,
  runAllOCR,
  runOCR,
  terminateOCR,
} from "./utils/pdfOcr.js";
import {
  Redo,
  Undo,
  clearAllMasks,
  clearPageMasks,
  endTask,
  incMaskingCount,
  initializeMaskingCanvas,
} from "./utils/maskingManager.js";
import {
  saveCurrentPage,
  saveExtractPdf,
  saveMaskedPdf,
} from "./utils/pdfExportManager.js";
import {
  dragMove,
  dragStart,
  dragEnd,
  mouseUpOutCanvas,
  mouseMoveOutCanvas,
  setDrawingMode,
} from "./utils/boxManager.js";
import { resetMessage } from "./utils/message.js";
import {
  clearRegexData,
  fetchAll,
  insertList,
  setRegex,
} from "./utils/regexManager.js";
import { hideElement, showElement, toggleHide } from "./utils/domHelpers.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 파일 메뉴 ----------------------------------------------------------------------
  const wrapperFile = document.getElementById("wrapper-file");
  const submenuFile = document.getElementById("submenu-file");

  // 편집 메뉴 ----------------------------------------------------------------------
  const wrapperEdit = document.getElementById("wrapper-edit");
  const submenuEdit = document.getElementById("submenu-edit");

  // 설정 메뉴 ----------------------------------------------------------------------
  const wrapperSetting = document.getElementById("wrapper-setting");
  const submenuSetting = document.getElementById("submenu-setting");

  const extractModal = document.getElementById("extract-modal");
  const regexModal = document.getElementById("regex-modal");
  const helpModal = document.getElementById("help-modal");

  document.addEventListener("click", (event) => {
    let targetId = event.target.id;
    resetMessage();

    if (
      event.target.className === "menu-name" ||
      event.target.className === "short-cut" ||
      event.target.className === "func-img" ||
      event.target.className === "tooltip"
    ) {
      targetId = event.target.parentElement.id;
    }

    switch (targetId) {
      case "minimize-btn":
      case "minimize-img":
        window.api.send("window-control", "minimize");
        break;
      case "maximize-btn":
      case "maximize-img":
        window.api.send("window-control", "maximize");
        break;
      case "close-btn":
      case "close-img":
        window.api.send("window-control", "close");
        break;
      case "menu-file":
        toggleHide(wrapperFile);
        break;
      case "open-pdf":
      case "open-pdf-btn":
      case "open-pdf-label":
        hideElement(wrapperFile);
        break;
      case "save-pdf-btn":
        hideElement(wrapperFile);
        saveMaskedPdf();
        break;
      case "menu-edit":
        toggleHide(wrapperEdit);
        break;
      case "undo-btn":
        Undo();
        hideElement(wrapperEdit);
        break;
      case "redo-btn":
        Redo();
        hideElement(wrapperEdit);
        break;
      case "ocr-btn":
        runAllOCR();
        hideElement(wrapperEdit);
        break;
      case "reset-all-btn":
        clearAllMasks();
        endTask();
        break;
      case "extract-select-btn":
        showElement(extractModal);
        hideElement(wrapperEdit);
        break;
      case "menu-setting":
        toggleHide(wrapperSetting);
        break;
      case "regex-btn":
        showElement(regexModal);
        hideElement(wrapperSetting);
        insertList();
        break;
      case "regex-clear-btn":
        clearRegexData();
        hideElement(wrapperSetting);
        break;
      case "menu-help":
        showElement(helpModal);
        break;
      case "help-modal-close":
        hideElement(helpModal);
        break;
      case "reset-btn":
        clearPageMasks(getCurrentPageNum());
        endTask();
        break;
      case "extract-btn":
        saveCurrentPage();
        break;
      case "undo-btn-icon":
        Undo();
        break;
      case "redo-btn-icon":
        Redo();
        break;
      case "mask-box-btn":
        setDrawingMode("maskBox");
        break;
      case "mask-erase-btn":
        setDrawingMode("maskErase");
        break;
      case "extract-ok":
        saveExtractPdf();
        hideElement(extractModal);
        break;
      case "extract-cancel":
        hideElement(extractModal);
        break;
      case "regex-ok":
        setRegex();
        break;
      case "regex-cancel":
        hideElement(regexModal);
        document.getElementById("regex-key").value = "";
        document.getElementById("regex-value").value = "";
        break;
    }
  });

  // 파일 메뉴 ----------------------------------------------------------------------
  wrapperFile.addEventListener("click", (event) => {
    if (!submenuFile.contains(event.target)) toggleHide(wrapperFile);
  });

  // 편집 메뉴 ----------------------------------------------------------------------
  wrapperEdit.addEventListener("click", (event) => {
    if (!submenuEdit.contains(event.target)) toggleHide(wrapperEdit);
  });

  wrapperSetting.addEventListener("click", (event) => {
    if (!submenuSetting.contains(event.target)) toggleHide(wrapperSetting);
  });

  // 에디터 메뉴 ---------------------------------------------------------------------
  document
    .getElementById("ocr-this-page")
    .addEventListener("click", async () => {
      const pdfDoc = getPdfDoc();
      if (!pdfDoc) return;

      const canvas = document.getElementById("pdf-canvas");
      const pageNum = getCurrentPageNum();

      incMaskingCount();
      displayWorkingModal();
      await runOCR(canvas, pageNum);
      hideWorkingModal();
      endTask();
    });

  document
    .getElementById("pick-mask-color")
    .addEventListener("change", (elem) => {
      elem.target.style.backgroundColor = elem.target.value;
      window.api.set({ key: "color", value: elem.target.value });
    });

  const maskingCanvas = document.getElementById("masking-canvas");
  maskingCanvas.addEventListener("mousedown", (event) => dragStart(event));
  maskingCanvas.addEventListener("mousemove", (event) => dragMove(event));
  maskingCanvas.addEventListener("mouseup", (event) => dragEnd(event));

  document.addEventListener("mousemove", (event) => mouseMoveOutCanvas(event));
  document.addEventListener("mouseup", (event) => mouseUpOutCanvas(event));

  // --- PDF 뷰어 및 페이지 네비게이션 기능 초기화 ---
  fetchAll();
  setupPdfLoading();
  setInitialMaskColor();
  setupPageNavigation();
  initializePdfViewer();
  initializeMaskingCanvas();

  window.addEventListener("beforeunload", async () => {
    terminateOCR();
  });
});
