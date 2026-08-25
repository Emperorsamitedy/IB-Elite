-- =============================================================
-- Annotated mock scripts: keep the OCR word boxes per page so
-- criterion marks can be overlaid on the scanned images.
-- =============================================================

alter table public.mock_scripts
  add column if not exists ocr_boxes jsonb;
