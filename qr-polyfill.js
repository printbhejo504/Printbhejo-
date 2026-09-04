import jsQR from "jsqr";

if (typeof window !== "undefined" && typeof window.BarcodeDetector !== "function") {
  class PrintBhejoBarcodeDetector {
    constructor(options = {}) {
      this.formats = options.formats || ["qr_code"];
      if (!this.formats.includes("qr_code")) throw new Error("Only QR codes are supported.");
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }

    static async getSupportedFormats() {
      return ["qr_code"];
    }

    async detect(source) {
      const width = source?.videoWidth || source?.naturalWidth || source?.width || 0;
      const height = source?.videoHeight || source?.naturalHeight || source?.height || 0;
      if (!width || !height) return [];
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.drawImage(source, 0, 0, width, height);
      const image = this.ctx.getImageData(0, 0, width, height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      return result ? [{ rawValue: result.data }] : [];
    }
  }

  window.BarcodeDetector = PrintBhejoBarcodeDetector;
}
