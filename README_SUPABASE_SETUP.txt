SmartCV Supabase Login and Pro Plan Setup

A. Create Supabase project

Open Supabase Dashboard.
Create a new project.
Copy Project URL and anon public key from Project Settings API.
Paste them in script.js:
const supabaseUrl = "YOUR_PROJECT_URL";
const supabaseKey = "YOUR_ANON_PUBLIC_KEY";

B. Create database tables

Open Supabase SQL Editor.
Run the complete file SUPABASE_DATABASE_SETUP.sql.
This creates profiles, payments, resumes, triggers, and RLS policies.

C. Enable email password login

Open Authentication Providers.
Enable Email provider.
Enable email and password login.
Add your website URL in Authentication URL Configuration.

D. How signup works

User enters full name, email, and password.
Supabase Auth creates the user in auth.users.
The trigger automatically saves user details in public.profiles.
User remains Free by default.

E. How login works

User email and password are verified by Supabase Auth.
The website checks the logged in user through Supabase Auth.
The website reads public.profiles through RLS.
Only active users can open form.html.

F. How Pro access works

Free templates stay open for logged in users.
Pro templates check public.profiles.is_pro.
Users cannot unlock Pro from localStorage.
Only database approval can set is_pro true.

G. Manual payment approval

User submits payment reference on payment.html.
The record is saved in public.payments with status pending.
Admin checks payment.
Admin runs ADMIN_APPROVE_PRO_PAYMENT.sql with the real transaction ID.
The trigger updates public.profiles.is_pro to true.
User logs in again and Pro templates become active.

H. Important security rules

Do not create an update policy that allows users to update public.profiles.is_pro.
Do not unlock Pro from frontend JavaScript.
Do not put service role key in frontend files.
Use service role key only in a secure backend or Supabase Edge Function.
