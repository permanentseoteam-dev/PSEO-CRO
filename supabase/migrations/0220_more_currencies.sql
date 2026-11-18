-- Allow GBP, EUR and SAR next to AED, USD and PKR. Structural only: no rows change.
-- Rates for the new codes are entered by an admin in Finance → Settings.
alter table public.ad_budgets drop constraint ad_budgets_currency_check, add constraint ad_budgets_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.ad_campaigns drop constraint ad_campaigns_currency_check, add constraint ad_campaigns_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.billing_profiles drop constraint billing_profiles_currency_check, add constraint billing_profiles_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.client_credit drop constraint client_credit_currency_check, add constraint client_credit_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.client_leads drop constraint client_leads_currency_check, add constraint client_leads_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.client_metric_daily drop constraint client_metric_daily_currency_check, add constraint client_metric_daily_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.client_opportunities drop constraint client_opportunities_currency_check, add constraint client_opportunities_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.client_terms drop constraint client_terms_currency_check, add constraint client_terms_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.clients drop constraint clients_currency_check, add constraint clients_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.credit_movements drop constraint credit_movements_currency_check, add constraint credit_movements_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.entities drop constraint entities_currency_check, add constraint entities_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.fx_rates drop constraint fx_rates_currency_check, add constraint fx_rates_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.hr_payslips drop constraint hr_payslips_currency_check, add constraint hr_payslips_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.invoices drop constraint invoices_currency_check, add constraint invoices_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.monthly_drafts drop constraint monthly_drafts_currency_check, add constraint monthly_drafts_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.pipeline_deals drop constraint pipeline_deals_currency_check, add constraint pipeline_deals_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.receipts drop constraint receipts_currency_check, add constraint receipts_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.salaries drop constraint salaries_currency_check, add constraint salaries_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.upwork_earnings drop constraint upwork_earnings_currency_check, add constraint upwork_earnings_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
alter table public.upwork_withdrawals drop constraint upwork_withdrawals_currency_check, add constraint upwork_withdrawals_currency_check check (currency in ('AED', 'USD', 'PKR', 'GBP', 'EUR', 'SAR'));
