export type ScanStatus = "UPLOADED" | "PROCESSING" | "ANNOTATED" | "FAILED";

/** Normalised pixel box on the uploaded image. */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrWord = {
  text: string;
  box: BoundingBox;
};

export type OcrResult = {
  text: string;
  words: OcrWord[];
};

export type MarkPoint = {
  /** The mark-scheme point being looked for. */
  text: string;
  present: boolean;
  /** Where it was found on the scan, when it was found. */
  box: BoundingBox | null;
};

export type AnnotationResult = {
  markPoints: MarkPoint[];
  awarded: number;
  total: number;
};

export type Scan = {
  id: string;
  student_id: string;
  question_id: string;
  image_url: string;
  ocr_text: string | null;
  ocr_bounding_boxes: OcrWord[] | null;
  annotation_result: AnnotationResult | null;
  status: ScanStatus;
  error_message: string | null;
};

export type ScanOcr = {
  /** Runs OCR over the stored object and returns text plus word boxes. */
  read(imagePath: string): Promise<OcrResult>;
};

export type ScanStorage = {
  /** Stores the image and returns the object path. */
  upload(input: {
    studentId: string;
    fileName: string;
    contentType: string;
    body: ArrayBuffer;
  }): Promise<string>;
  /** Time-limited URL the browser can render. */
  signedUrl(path: string): Promise<string>;
  /** Bytes for the OCR provider. */
  download(path: string): Promise<ArrayBuffer>;
};
