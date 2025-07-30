import { throttle } from "./domHelpers.js";
import { renderPage, getPdfDoc, getCurrentPageNum } from "./pdfViewer.js";
import { moveScroll } from "./scrollManager.js";

export function movePage(direction) {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;

  let currentPageNum = getCurrentPageNum();
  if (direction === -1 && currentPageNum <= 1) return;
  if (direction === 1 && currentPageNum >= pdfDoc.numPages) return;

  currentPageNum += direction;
  moveScroll(currentPageNum);
  renderPage(currentPageNum);
}

export function setupPageNavigation() {
  const prevPageBtn = document.getElementById("prev-page-btn");
  const nextPageBtn = document.getElementById("next-page-btn");
  const pdfViewerContainer = document.getElementById("pdf-viewer-container");

  prevPageBtn.addEventListener("click", () => movePage(-1));
  nextPageBtn.addEventListener("click", () => movePage(1));

  window.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        movePage(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        movePage(1);
        break;
      default:
        break;
    }
  });

  // 스크롤 이벤트 디바운싱을 위한 변수
  const throttledMovePage = throttle((direction) => movePage(direction), 100);

  pdfViewerContainer.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      if (event.deltaY > 0) throttledMovePage(1);
      else if (event.deltaY < 0) throttledMovePage(-1);
    },
    { passive: false }
  );
}
