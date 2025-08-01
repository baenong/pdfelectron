import * as pdfjsLib from "../pdfjs/pdf.min.mjs";
import {
  syncMaskingCanvasSize,
  redrawPageMasks,
  clearAllStoredMasks,
} from "./maskingManager.js";
import { PDFDocument } from "../pdfjs/pdf-lib.esm.min.js";
import {
  moveScroll,
  resetThumbHeight,
  setThumbHeight,
} from "./scrollManager.js";
import { setMessage } from "./message.js";
import { deactiveRedoButtons, deactiveUndoButtons } from "./domHelpers.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "../pdfjs/pdf.worker.min.mjs";

let pdfDoc = null;
let currentPageNum = 1;
let pageRendering = false;

const pdfCanvas = document.getElementById("pdf-canvas");
const context = pdfCanvas.getContext("2d");
const pageInfoSpan = document.getElementById("page-info");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pdfViewerContainer = document.getElementById("pdf-viewer-container");

export const INITIAL_RENDER_SCALE = 3;

function adjustCanvasSize() {
  if (!pdfDoc || !currentPageNum) return;

  const pagePromise = pdfDoc.getPage(currentPageNum);
  pagePromise
    .then((page) => {
      const viewport = page.getViewport({ scale: INITIAL_RENDER_SCALE });

      const containerWidth = pdfViewerContainer.clientWidth - 5;
      const containerHeight = pdfViewerContainer.clientHeight - 5;
      const aspectRatio = viewport.height / viewport.width;

      let displayWidth, displayHeight;

      displayHeight = containerHeight;
      displayWidth = containerHeight / aspectRatio;

      if (displayWidth > containerWidth) {
        displayWidth = containerWidth;
        displayHeight = containerWidth * aspectRatio;
      }

      pdfCanvas.style.width = `${displayWidth}px`;
      pdfCanvas.style.height = `${displayHeight}px`;

      syncMaskingCanvasSize(
        pdfCanvas.width,
        pdfCanvas.height,
        pdfCanvas.style.width,
        pdfCanvas.style.height
      );

      renderPage(currentPageNum);
    })
    .catch((error) => {
      console.error("Resize 에러: ", error);
    });
}

export async function renderPage(pageNum) {
  if (!pdfDoc) return;

  if (!pageRendering) {
    pageRendering = true;
    currentPageNum = pageNum;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: INITIAL_RENDER_SCALE });

    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    try {
      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        pageRendering = false;

        updatePageInfo();
        updatePageNavigationButtons();

        redrawPageMasks(currentPageNum);
      });
    } catch (error) {
      setMessage(`페이지 ${pageNum}를 렌더링하는 데 실패했습니다.`);

      pdfCanvas.style.width = "";
      pdfCanvas.style.height = "";

      redrawPageMasks(currentPageNum);
    }
  }
}

function clearCanvas() {
  context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
}

async function mergePdfs(pdfs) {
  const mergedPdf = await PDFDocument.create();

  for (const pdfBytes of pdfs) {
    try {
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      for (const page of copiedPages) mergedPdf.addPage(page);
    } catch (err) {
      setMessage("암호화된 PDF 파일입니다.");
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  return mergedPdfBytes;
}

export async function setInitialMaskColor() {
  const pickColor = document.getElementById("pick-mask-color");
  const initialColor = await window.api.fetch("color");

  if (initialColor) pickColor.value = initialColor;
  else pickColor.value = "#000000";
  pickColor.style.backgroundColor = pickColor.value;
}

export function setupPdfLoading() {
  const openPdfInput = document.getElementById("open-pdf");

  openPdfInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    const pdfs = [];
    currentPageNum = 1;
    pdfDoc = null;

    for (const file of files) {
      if (file && file.type === "application/pdf") {
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const uint8Array = new Uint8Array(arrayBuffer);
        pdfs.push(uint8Array);
      }
    }

    if (pdfs.length === 0) return;
    const mergedPDfs = await mergePdfs(pdfs);

    try {
      pdfDoc = await pdfjsLib.getDocument({ data: mergedPDfs }).promise;
      setThumbHeight();
      clearAllStoredMasks();
      renderPage(1);
      adjustCanvasSize();
      activeButtons();
      moveScroll(1);
    } catch (error) {
      setMessage("PDF 파일을 로드하는 데 실패했습니다.");
      console.error(error);

      clearCanvas();
      clearAllStoredMasks();
      initializePdfViewer();
    }
  });
}

function updatePageInfo() {
  if (pdfDoc) {
    pageInfoSpan.textContent = `${currentPageNum} / ${pdfDoc.numPages}`;
  } else {
    pageInfoSpan.textContent = `- / -`;
  }
}

function updatePageNavigationButtons() {
  if (!pdfDoc) {
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }
  prevPageBtn.disabled = currentPageNum <= 1;
  nextPageBtn.disabled = currentPageNum >= pdfDoc.numPages;
}

export function getPdfDoc() {
  return pdfDoc;
}

export function getCurrentPageNum() {
  return currentPageNum;
}

export function getNumPages() {
  if (pdfDoc) return pdfDoc.numPages;
  else return 0;
}

export function initializePdfViewer() {
  updatePageInfo();
  updatePageNavigationButtons();
  resetThumbHeight();
}

window.addEventListener("resize", () => {
  if (pdfDoc) {
    adjustCanvasSize();
    setThumbHeight();
    moveScroll(currentPageNum);
  }
});

function activeButtons() {
  const disableElements = document.querySelectorAll(".disabled");
  disableElements.forEach((elem) => {
    elem.classList.remove("disabled");
  });

  deactiveUndoButtons();
  deactiveRedoButtons();
}
