CREATE INDEX "subscription_user_status_idx" ON "subscription" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "subscription_org_status_idx" ON "subscription" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "subscription_status_period_end_idx" ON "subscription" USING btree ("status","current_period_end");