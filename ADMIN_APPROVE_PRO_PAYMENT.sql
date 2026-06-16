update public.payments
set status = 'approved',
    approved_at = now(),
    admin_note = 'Payment verified and Pro access approved'
where transaction_id = 'PASTE_TRANSACTION_ID_HERE';
