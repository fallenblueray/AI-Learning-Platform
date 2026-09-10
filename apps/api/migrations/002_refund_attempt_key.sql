-- Associate provider callbacks with the exact refund attempt, including retries.
ALTER TABLE refunds ADD COLUMN request_key VARCHAR(64) NULL;
