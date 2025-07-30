import { showElement, throttle } from "./domHelpers.js";
import { movePage } from "./pageNavigation.js";
import { getCurrentPageNum, getNumPages, renderPage } from "./pdfViewer.js";

const thumb = document.getElementById("scroll-thumb");
const container = document.getElementById("pdf-viewer-container");
const thumbContainer = document.getElementById("scroll-thumb-container");

let currentTop = 0;
let thumbHeight = 0;
let isDragging = false;
let lowerBound = 0;
let clickedPos = 0;
let clickedTop = 0;

export function setThumbHeight() {
  const numPages = getNumPages();

  if (numPages > 1) {
    const maxHeight = thumbContainer.clientHeight;
    showElement(thumb);

    thumbHeight = (maxHeight / numPages).toFixed(2);
    thumb.style.height = `${thumbHeight}px`;
    currentTop = 0;
    lowerBound = maxHeight - thumbHeight;
  }
}

export function resetThumbHeight() {
  thumb.style.height = "0px";
  currentTop = 0;
  thumbHeight = 0;
  isDragging = false;
  lowerBound = 0;
}

export function moveScroll(pageNum) {
  currentTop = (pageNum - 1) * thumbHeight;
  thumb.style.top = `${currentTop}px`;
}

function findAdjacentPage() {
  const newPageNum = Math.round(currentTop / thumbHeight);
  const currentPage = getCurrentPageNum();

  if (newPageNum !== currentPage) movePage(newPageNum - currentPage);
}

thumb.addEventListener("mousedown", (event) => {
  if (thumbHeight < 1) return;
  isDragging = true;
  thumb.classList.add("dragging");

  clickedPos = event.clientY;
  clickedTop = Number(thumb.style.top.slice(0, -2));
});

// Apply Throttling
container.addEventListener(
  "mousemove",
  throttle((event) => {
    if (isDragging) {
      let y = event.clientY;
      let offset = y - clickedPos;

      currentTop = clickedTop + offset;
      if (currentTop < 0) currentTop = 0;
      if (currentTop > lowerBound) currentTop = lowerBound;

      requestAnimationFrame(() => {
        thumb.style.top = `${currentTop}px`;
      });
    }
  }, 16)
);

container.addEventListener("mouseup", () => {
  if (thumbHeight < 1) return;

  if (isDragging) {
    isDragging = false;
    thumb.classList.remove("dragging");
    findAdjacentPage();
  }
});

thumbContainer.addEventListener("click", (event) => {
  const numPages = getNumPages();
  if (numPages === 0) return;

  const rect = thumbContainer.getBoundingClientRect();
  const clicked = event.clientY - rect.top;

  const targetPage = Math.ceil(
    clicked / (thumbContainer.clientHeight / numPages)
  );
  const currentPage = getCurrentPageNum();

  if (targetPage >= 1 && targetPage <= numPages) {
    movePage(targetPage - currentPage);
  }
});
