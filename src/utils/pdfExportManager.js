import { PDFDocument } from "../pdfjs/pdf-lib.esm.min.js";
import {
  INITIAL_RENDER_SCALE,
  getCurrentPageNum,
  getPdfDoc,
} from "./pdfViewer.js";
import { getPageMasks } from "./maskingManager.js";
import { setMessage } from "./message.js";

const RENDER_SCALE = 3;

export async function saveExtractPdf() {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;

  const newPdfDoc = await PDFDocument.create();
  const numPages = pdfDoc.numPages;

  let inputValue = document.getElementById("extract-pages").value;
  inputValue = inputValue.replace(" ", "");

  const regexPage = /[^0-9,]/;
  if (regexPage.test(inputValue)) {
    setMessage("정수와 쉼표를 입력하세요");
    return;
  }

  let extractPages = inputValue.split(",");
  extractPages = extractPages.filter((elem) => {
    return elem !== "";
  });

  const uniquePages = new Set(extractPages);
  extractPages = [...uniquePages];
  extractPages = extractPages.map(Number).sort((a, b) => a - b);

  for (const pageNum of extractPages) {
    if (!(pageNum < 1 || pageNum > numPages)) {
      const { maskImageBytes, newPageWidth, newPageHeight } =
        await getPngByPageNum(pdfDoc, pageNum);

      const embeddedMaskImage = await newPdfDoc.embedPng(maskImageBytes);
      const newPage = newPdfDoc.addPage([newPageWidth, newPageHeight]);
      newPage.drawImage(embeddedMaskImage, {
        x: 0,
        y: 0,
        width: newPageWidth,
        height: newPageHeight,
      });
    }
  }

  // 새로운 PDF를 저장합니다.
  const pdfBytes = await newPdfDoc.save();
  savePdf(pdfBytes);
}

export async function saveMaskedPdf() {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;

  const newPdfDoc = await PDFDocument.create();
  const numPages = pdfDoc.numPages;

  // 각 페이지를 순회하며 마스킹을 적용합니다.
  for (let i = 0; i < numPages; i++) {
    const pageNum = i + 1;

    const { maskImageBytes, newPageWidth, newPageHeight } =
      await getPngByPageNum(pdfDoc, pageNum);

    // 마스킹 캔버스 이미지를 PDF에 임베드합니다.
    const embeddedMaskImage = await newPdfDoc.embedPng(maskImageBytes);
    const newPage = newPdfDoc.addPage([newPageWidth, newPageHeight]);
    newPage.drawImage(embeddedMaskImage, {
      x: 0, // 이미지 크기를 페이지 크기에 맞춰 삽입하므로 x, y는 0, 0
      y: 0,
      width: newPageWidth, // PDF 페이지 너비에 맞춰 마스크 이미지 너비 조정
      height: newPageHeight, // PDF 페이지 높이에 맞춰 마스크 이미지 높이 조정
    });
  }

  const pdfBytes = await newPdfDoc.save();
  savePdf(pdfBytes);
}

export async function saveCurrentPage() {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;

  const newPdfDoc = await PDFDocument.create();
  const pageNum = getCurrentPageNum();

  const { maskImageBytes, newPageWidth, newPageHeight } = await getPngByPageNum(
    pdfDoc,
    pageNum
  );

  const embeddedMaskImage = await newPdfDoc.embedPng(maskImageBytes);
  const newPage = newPdfDoc.addPage([newPageWidth, newPageHeight]);
  newPage.drawImage(embeddedMaskImage, {
    x: 0,
    y: 0,
    width: newPageWidth,
    height: newPageHeight,
  });

  const pdfBytes = await newPdfDoc.save();
  savePdf(pdfBytes);
}

async function savePdf(pdfBytes) {
  const defaultFileName = "document.pdf";
  const saved = await window.api.saveFile(pdfBytes, defaultFileName);

  if (saved) {
    setMessage("저장되었습니다.", "gold");
  } else {
    setMessage("저장에 실패했거나 최소되었습니다.", "red");
  }
}

async function getPngByPageNum(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);

  const viewport = page.getViewport({
    scale: RENDER_SCALE,
  });
  const masks = getPageMasks(pageNum);

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  tempCanvas.width = viewport.width;
  tempCanvas.height = viewport.height;

  // 페이지 렌더링
  await page.render({
    canvasContext: tempCtx,
    viewport: viewport,
  }).promise;

  const scale = RENDER_SCALE / INITIAL_RENDER_SCALE;

  if (masks && masks.length > 0) {
    masks.forEach((maskInfo) => {
      const sx = (maskInfo.x - 5) * scale;
      const sy = (maskInfo.y - 5) * scale;
      const sw = (maskInfo.width + 10) * scale;
      const sh = (maskInfo.height + 15) * scale;

      if (maskInfo.isBlur) {
        const blurCanvas = document.createElement("canvas");
        const blurCtx = blurCanvas.getContext("2d");

        const retouch = 15 * scale;
        const dx = sx - retouch;
        const dy = sy - retouch;
        const dw = sw + 2 * retouch;
        const dh = sh + 2 * retouch;

        blurCanvas.width = dw;
        blurCanvas.height = dh;

        blurCtx.filter = "blur(8px)";
        blurCtx.drawImage(tempCanvas, dx, dy, dw, dh, 0, 0, dw, dh);
        blurCtx.fillStyle = "rgb(255, 255, 255, 0.5)";
        blurCtx.fillRect(0, 0, dw, dh);
        blurCtx.filter = "none";

        tempCtx.drawImage(blurCanvas, retouch, retouch, sw, sh, sx, sy, sw, sh);
      } else {
        if (maskInfo.color) {
          const { r, g, b } = maskInfo.color;
          tempCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
          tempCtx.fillStyle = "black";
        }

        tempCtx.fillRect(sx, sy, sw, sh);
      }
    });
  }

  const maskImageBytes = tempCanvas.toDataURL("image/png");
  const newPageWidth = viewport.width / RENDER_SCALE;
  const newPageHeight = viewport.height / RENDER_SCALE;

  return {
    maskImageBytes: maskImageBytes,
    newPageWidth: newPageWidth,
    newPageHeight: newPageHeight,
  };
}
