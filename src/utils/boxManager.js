import { throttle } from "./domHelpers.js";
import {
  addMask,
  deleteMaskInBox,
  endTask,
  incMaskingCount,
  redrawPageMasks,
} from "./maskingManager.js";
import { getCurrentPageNum, getPdfDoc } from "./pdfViewer.js";

const maskingCanvas = document.getElementById("masking-canvas");
const maskingCtx = maskingCanvas.getContext("2d");

let isDrawing = false;
const boxInfo = { x: 0, y: 0, width: 0, height: 0 };
let SCALE_X = 0;
let SCALE_Y = 0;
let currentDrawingMode = "maskBox";

export function setDrawingMode(mode) {
  currentDrawingMode = mode;
  document.getElementById("mask-box-btn").classList.toggle("isused");
  document.getElementById("mask-erase-btn").classList.toggle("isused");
}

export function dragStart(event) {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  if (!currentDrawingMode) return;

  isDrawing = true;

  SCALE_X = maskingCanvas.width / parseFloat(maskingCanvas.style.width);
  SCALE_Y = maskingCanvas.height / parseFloat(maskingCanvas.style.height);

  boxInfo.x = event.offsetX * SCALE_X;
  boxInfo.y = event.offsetY * SCALE_Y;
}

const throttledDragMove = throttle((event, offsetX, offsetY) => {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  if (!currentDrawingMode) return;
  if (!isDrawing) return;

  const pageNum = getCurrentPageNum();

  boxInfo.width =
    (offsetX === -1 ? event.offsetX : offsetX) * SCALE_X - boxInfo.x;
  boxInfo.height =
    (offsetY === -1 ? event.offsetY : offsetY) * SCALE_Y - boxInfo.y;

  clearCanvas();
  redrawPageMasks(pageNum);
  drawRectangle();
}, 16);

export function dragMove(event, offsetX = -1, offsetY = -1) {
  throttledDragMove(event, offsetX, offsetY);
}

export function dragEnd(event, offsetX = -1, offsetY = -1) {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  if (!currentDrawingMode) return;
  if (!isDrawing) return;
  isDrawing = false;

  const endX = (offsetX === -1 ? event.offsetX : offsetX) * SCALE_X;
  const endY = (offsetY === -1 ? event.offsetY : offsetY) * SCALE_Y;

  boxInfo.width = endX - boxInfo.x;
  boxInfo.height = endY - boxInfo.y;

  if (Math.abs(boxInfo.width) > 0 && Math.abs(boxInfo.height) > 0) {
    boxInfo.x = Math.min(boxInfo.x, endX);
    boxInfo.y = Math.min(boxInfo.y, endY);
    boxInfo.width = Math.abs(boxInfo.width);
    boxInfo.height = Math.abs(boxInfo.height);

    if (boxInfo.width < 11 || boxInfo.height < 11) return;

    const pageNum = getCurrentPageNum();
    clearCanvas();

    if (currentDrawingMode === "maskBox") {
      incMaskingCount();
      addMask(pageNum, {
        ...boxInfo,
        kind: "box",
      });
    } else if (currentDrawingMode === "maskErase") {
      deleteMaskInBox(pageNum, boxInfo);
    }
    endTask();
  }
}

export function mouseUpOutCanvas(event) {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  if (!isDrawing) return;

  const { clientX, clientY } = event;
  const boundary = maskingCanvas.getBoundingClientRect();

  if (
    clientX < boundary.left ||
    clientX > boundary.right ||
    clientY < boundary.top ||
    clientY > boundary.bottom
  ) {
    let offsetX = (boxInfo.width + boxInfo.x) / SCALE_X;
    let offsetY = (boxInfo.height + boxInfo.y) / SCALE_Y;

    if (clientX < boundary.left) offsetX = 1;
    else if (clientX > boundary.right) offsetX = boundary.width;

    if (clientY < boundary.top) offsetY = 1;
    else if (clientY > boundary.bottom) offsetY = boundary.height;

    dragEnd(event, offsetX, offsetY);
  }
}

export function mouseMoveOutCanvas(event) {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  if (!isDrawing) return;

  const { clientX, clientY } = event;
  const boundary = maskingCanvas.getBoundingClientRect();

  if (
    clientX < boundary.left ||
    clientX > boundary.right ||
    clientY < boundary.top ||
    clientY > boundary.bottom
  ) {
    let offsetX = clientX - boundary.x;
    let offsetY = clientY - boundary.y;

    if (clientX < boundary.left) offsetX = 1;
    else if (clientX > boundary.right) offsetX = boundary.width;

    if (clientY < boundary.top) offsetY = 1;
    else if (clientY > boundary.bottom) offsetY = boundary.height;

    dragMove(event, offsetX, offsetY);
  }
}

function drawRectangle() {
  maskingCtx.beginPath();
  maskingCtx.rect(boxInfo.x, boxInfo.y, boxInfo.width, boxInfo.height);
  maskingCtx.lineWidth = 2;
  maskingCtx.strokeStyle = "red";
  maskingCtx.stroke();
}

function clearCanvas() {
  maskingCtx.clearRect(0, 0, maskingCanvas.width, maskingCanvas.height);
}
