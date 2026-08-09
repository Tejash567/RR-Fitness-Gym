-- Migration 004: Razorpay Payment Support
-- Safe, additive migration preserving all existing database structures and data.

-- 1. Add Razorpay payment details columns to payments table if not existing
alter table payments add column if not exists razorpay_order_id text;
alter table payments add column if not exists razorpay_payment_id text;
alter table payments add column if not exists razorpay_signature text;

-- 2. Safely expand payment_method check constraint to include 'razorpay' and 'online'
alter table payments drop constraint if exists payments_payment_method_check;
alter table payments add constraint payments_payment_method_check check (payment_method in ('cash', 'upi', 'bank_transfer', 'razorpay', 'online', 'other'));
