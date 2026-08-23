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
  /** Examiner note on this point, when the marker is an AI one. */
  comment?: string | null;
};

export type AnnotationResult = {
  markPoints: MarkPoint[];
  awarded: number;
  total: number;
  /** Overall advice; only the AI marker produces it. */
  feedback?: string | null;
  /** Which marker produced this, so the UI can be honest about it. */
  source?: "ai" | "keywords";
};

/** Everything the marker is allowed to mark against: the question's own
 * curriculum slot plus its published mark scheme. */
export type QuestionContext = {
  prompt: string;
  answer: string | null;
  solution: string | null;
  marks: number;
  commandTerm: string | null;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
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
