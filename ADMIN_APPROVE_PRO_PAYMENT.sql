update public.payments
set status = 'approved',
    approved_at = now(),
    admin_note = 'Approved by admin'
where transaction_id = 'PASTE_TRANSACTION_ID_HERE';

select id, email, full_name, is_pro, plan_name, pro_purchased_at
from public.profiles
where id = (
  select user_id
  from public.payments
  where transaction_id = 'PASTE_TRANSACTION_ID_HERE'
);
