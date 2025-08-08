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

  const regexPage = /^(\d+(-\d+)?)(,(\d+(-\d+)?))*$/;
  if (!regexPage.test(inputValue)) {
    setMessage("올바른 페이지 번호를 입력하세요");
    return;
  }

  const parts = inputValue.split(",");
  const pages = new Set();
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);

      if (start < 1 || end < 1) {
        setMessage("페이지 번호는 양수로 입력하세요");
        return;
      }

      const from = Math.min(start, end);
      const to = Math.max(start, end);
      for (let i = from; i <= to; i++) {
        pages.add(i);
      }
    } else {
      const num = Number(part);
      if (num < 1) {
        setMessage("페이지 번호는 양수로 입력하세요");
        return;
      }
      pages.add(Number(part));
    }
  }

  const extractPages = [...pages].map(Number).sort((a, b) => a - b);

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
    setMessage("저장되었습니다.", "#2FBB4F", "#2B3137");
  } else {
    setMessage(
      "오류가 발생했습니다. 파일이 열려있거나 경로가 잘못되었을 수 있습니다.",
      "#F0440A"
    );
  }
}

function convertSourceInfo(maskInfo) {
  const scale = RENDER_SCALE / INITIAL_RENDER_SCALE;
  const sx = (maskInfo.x - 5) * scale;
  const sy = (maskInfo.y - 5) * scale;
  const sw = (maskInfo.width + 10) * scale;
  const sh = (maskInfo.height + 15) * scale;

  return { sx, sy, sw, sh };
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
    const blurMasks = masks.filter((mask) => mask.isBlur);
    const boxMasks = masks.filter((mask) => !mask.isBlur);

    if (blurMasks.length > 0) {
      const opencvLoaded =
        typeof cv !== "undefined" && typeof cv.imread === "function";

      if (opencvLoaded) {
        const src = cv.imread(tempCanvas);
        blurMasks.forEach((maskInfo) => {
          const { sx, sy, sw, sh } = convertSourceInfo(maskInfo);

          const rect = new cv.Rect(sx, sy, sw, sh);
          const roi = src.roi(rect);

          // const smallSize = new cv.Size(sw / 20, sh / 20);
          // const smallImg = new cv.Mat();
          // cv.resize(roi, smallImg, smallSize, 0, 0, cv.INTER_AREA);

          // const enlargedImg = new cv.Mat();
          // cv.resize(
          //   smallImg,
          //   enlargedImg,
          //   new cv.Size(rect.width, rect.height),
          //   0,
          //   0,
          //   cv.INTER_AREA
          // );
          // enlargedImg.copyTo(roi);
          // smallImg.delete();
          // enlargedImg.delete();

          const blur = new cv.Mat();

          const intHeight = Math.floor(sh * 1.5);
          const gaussian = intHeight % 2 === 0 ? intHeight + 1 : intHeight;

          cv.GaussianBlur(
            roi,
            blur,
            new cv.Size(gaussian, gaussian),
            0,
            0,
            cv.BORDER_DEFAULT
          );
          blur.copyTo(roi);
          blur.delete();

          roi.delete();
        });
        cv.imshow(tempCanvas, src);
        src.delete();
      } else {
        const { sx, sy, sw, sh } = convertSourceInfo(maskInfo);

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
      }
    }

    boxMasks.forEach((maskInfo) => {
      const { sx, sy, sw, sh } = convertSourceInfo(maskInfo);

      const { r, g, b } = maskInfo.color
        ? maskInfo.color
        : { r: 0, g: 0, b: 0 };

      tempCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      tempCtx.fillRect(sx, sy, sw, sh);
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
