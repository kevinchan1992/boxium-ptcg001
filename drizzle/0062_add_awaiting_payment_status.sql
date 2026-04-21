-- Add awaiting_payment to gradingSubmissions status enum
ALTER TABLE `gradingSubmissions` 
  MODIFY COLUMN `status` enum('awaiting_payment','pending_shipment','received','submitted_to_psa','grading','graded','payment_overdue','paid','returned','completed','cancelled') NOT NULL DEFAULT 'pending_shipment';
