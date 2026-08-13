-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','pharmacist','assistant');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "profiles readable by staff" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profile insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles admin write" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'assistant'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.medicine_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicine_categories TO authenticated;
GRANT ALL ON public.medicine_categories TO service_role;
ALTER TABLE public.medicine_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.medicine_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat write" ON public.medicine_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));
CREATE POLICY "sup update" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));

-- MEDICINES
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('MED-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  name text NOT NULL,
  generic_name text,
  brand text,
  category_id uuid REFERENCES public.medicine_categories(id),
  dosage_form text NOT NULL DEFAULT 'Tablet',
  strength text,
  unit text NOT NULL DEFAULT 'Tablet',
  reorder_level integer NOT NULL DEFAULT 50 CHECK (reorder_level >= 0),
  storage_location text,
  prescription_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "med read" ON public.medicines FOR SELECT TO authenticated USING (true);
CREATE POLICY "med insert" ON public.medicines FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));
CREATE POLICY "med update" ON public.medicines FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));

-- BATCHES
CREATE TABLE public.medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  batch_number text NOT NULL,
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  current_quantity integer NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  manufacturing_date date,
  expiry_date date NOT NULL,
  purchase_price numeric(12,2),
  supplier_id uuid REFERENCES public.suppliers(id),
  date_received date NOT NULL DEFAULT current_date,
  storage_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicine_id, batch_number)
);
GRANT SELECT, INSERT, UPDATE ON public.medicine_batches TO authenticated;
GRANT ALL ON public.medicine_batches TO service_role;
ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch read" ON public.medicine_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batch insert" ON public.medicine_batches FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "batch update" ON public.medicine_batches FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_batch_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.manufacturing_date IS NOT NULL AND NEW.expiry_date <= NEW.manufacturing_date THEN
    RAISE EXCEPTION 'Expiry date must be after manufacturing date';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER batch_dates_check BEFORE INSERT OR UPDATE ON public.medicine_batches
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_dates();

-- PURCHASES
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('PO-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  invoice_number text,
  purchase_date date NOT NULL DEFAULT current_date,
  received_by uuid REFERENCES auth.users(id),
  received_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pur read" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "pur insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  batch_id uuid REFERENCES public.medicine_batches(id),
  batch_number text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_price numeric(12,2),
  manufacturing_date date,
  expiry_date date NOT NULL
);
GRANT SELECT, INSERT ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "puri read" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "puri insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('PT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  name text NOT NULL,
  contact_number text,
  gender text,
  age integer,
  clinic_reference text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pat read" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "pat insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "pat update" ON public.patients FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('RX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  doctor_name text NOT NULL,
  prescription_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rx read" ON public.prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rx insert" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rx update" ON public.prescriptions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  prescribed_quantity integer NOT NULL CHECK (prescribed_quantity > 0),
  dosage_instructions text,
  duration text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_items TO authenticated;
GRANT ALL ON public.prescription_items TO service_role;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rxi read" ON public.prescription_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "rxi write" ON public.prescription_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- DISPENSING
CREATE TABLE public.dispensings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('DSP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  patient_id uuid REFERENCES public.patients(id),
  prescription_id uuid REFERENCES public.prescriptions(id),
  dispensed_at timestamptz NOT NULL DEFAULT now(),
  dispensed_by uuid REFERENCES auth.users(id),
  dispensed_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dispensings TO authenticated;
GRANT ALL ON public.dispensings TO service_role;
ALTER TABLE public.dispensings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsp read" ON public.dispensings FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsp insert" ON public.dispensings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.dispensing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensing_id uuid NOT NULL REFERENCES public.dispensings(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  batch_id uuid NOT NULL REFERENCES public.medicine_batches(id),
  batch_number text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0)
);
GRANT SELECT, INSERT ON public.dispensing_items TO authenticated;
GRANT ALL ON public.dispensing_items TO service_role;
ALTER TABLE public.dispensing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dspi read" ON public.dispensing_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "dspi insert" ON public.dispensing_items FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- STOCK TRANSACTIONS
CREATE TYPE public.stock_txn_type AS ENUM ('received','dispensed','damaged','expired','returned','adjustment');

CREATE TABLE public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  batch_id uuid REFERENCES public.medicine_batches(id),
  batch_number text,
  txn_type public.stock_txn_type NOT NULL,
  quantity_change integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  reason text,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT ALL ON public.stock_transactions TO service_role;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn read" ON public.stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "txn insert" ON public.stock_transactions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  action text NOT NULL,
  module text NOT NULL,
  record_ref text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- SETTINGS
CREATE TABLE public.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pharmacy_name text NOT NULL DEFAULT 'Clinic Pharmacy',
  expiry_warning_days integer NOT NULL DEFAULT 90 CHECK (expiry_warning_days > 0),
  default_reorder_level integer NOT NULL DEFAULT 50 CHECK (default_reorder_level >= 0),
  low_stock_notifications boolean NOT NULL DEFAULT true,
  expiry_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "set read" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "set update" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.settings (id) VALUES (true);

CREATE OR REPLACE FUNCTION public.current_user_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(full_name,'') FROM public.profiles WHERE id = auth.uid()), 'System')
$$;

CREATE OR REPLACE FUNCTION public.record_purchase(
  p_supplier_id uuid, p_invoice_number text, p_purchase_date date, p_notes text, p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_purchase_id uuid; v_item jsonb; v_batch public.medicine_batches; v_prev int; v_qty int;
  v_uname text := public.current_user_name(); v_ref text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'Supplier is required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one item is required'; END IF;

  INSERT INTO public.purchases (supplier_id, invoice_number, purchase_date, notes, received_by, received_by_name)
  VALUES (p_supplier_id, p_invoice_number, COALESCE(p_purchase_date, current_date), p_notes, auth.uid(), v_uname)
  RETURNING id, reference INTO v_purchase_id, v_ref;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
    IF COALESCE(v_item->>'batch_number','') = '' THEN RAISE EXCEPTION 'Batch number is required'; END IF;

    SELECT * INTO v_batch FROM public.medicine_batches
      WHERE medicine_id = (v_item->>'medicine_id')::uuid AND batch_number = (v_item->>'batch_number');

    IF v_batch.id IS NULL THEN
      v_prev := 0;
      INSERT INTO public.medicine_batches (medicine_id, batch_number, quantity_received, current_quantity,
        manufacturing_date, expiry_date, purchase_price, supplier_id, date_received, storage_location)
      VALUES ((v_item->>'medicine_id')::uuid, v_item->>'batch_number', v_qty, v_qty,
        NULLIF(v_item->>'manufacturing_date','')::date, (v_item->>'expiry_date')::date,
        NULLIF(v_item->>'purchase_price','')::numeric, p_supplier_id, COALESCE(p_purchase_date, current_date),
        NULLIF(v_item->>'storage_location',''))
      RETURNING * INTO v_batch;
    ELSE
      v_prev := v_batch.current_quantity;
      UPDATE public.medicine_batches SET
        quantity_received = quantity_received + v_qty,
        current_quantity = current_quantity + v_qty,
        purchase_price = COALESCE(NULLIF(v_item->>'purchase_price','')::numeric, purchase_price),
        supplier_id = p_supplier_id,
        date_received = COALESCE(p_purchase_date, current_date)
      WHERE id = v_batch.id RETURNING * INTO v_batch;
    END IF;

    INSERT INTO public.purchase_items (purchase_id, medicine_id, batch_id, batch_number, quantity,
      purchase_price, manufacturing_date, expiry_date)
    VALUES (v_purchase_id, (v_item->>'medicine_id')::uuid, v_batch.id, v_batch.batch_number, v_qty,
      NULLIF(v_item->>'purchase_price','')::numeric, NULLIF(v_item->>'manufacturing_date','')::date,
      (v_item->>'expiry_date')::date);

    INSERT INTO public.stock_transactions (medicine_id, batch_id, batch_number, txn_type, quantity_change,
      previous_quantity, new_quantity, reason, user_id, user_name)
    VALUES ((v_item->>'medicine_id')::uuid, v_batch.id, v_batch.batch_number, 'received', v_qty,
      v_prev, v_prev + v_qty, 'Stock received on ' || COALESCE(p_invoice_number, v_ref), auth.uid(), v_uname);
  END LOOP;

  INSERT INTO public.audit_logs (user_id, user_name, action, module, record_ref, description)
  VALUES (auth.uid(), v_uname, 'Received stock', 'Purchases', v_ref,
    v_uname || ' recorded purchase ' || v_ref || ' with ' || jsonb_array_length(p_items) || ' item(s)');

  RETURN v_purchase_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, text, date, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_dispensing(
  p_patient_id uuid, p_prescription_id uuid, p_notes text, p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_id uuid; v_ref text; v_item jsonb; v_batch public.medicine_batches; v_qty int;
  v_uname text := public.current_user_name(); v_med text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one item is required'; END IF;

  INSERT INTO public.dispensings (patient_id, prescription_id, notes, dispensed_by, dispensed_by_name)
  VALUES (p_patient_id, p_prescription_id, p_notes, auth.uid(), v_uname)
  RETURNING id, code INTO v_id, v_ref;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    SELECT * INTO v_batch FROM public.medicine_batches WHERE id = (v_item->>'batch_id')::uuid FOR UPDATE;
    IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
    IF v_batch.expiry_date <= current_date THEN
      RAISE EXCEPTION 'Batch % is expired and cannot be dispensed', v_batch.batch_number;
    END IF;
    IF v_qty > v_batch.current_quantity THEN
      RAISE EXCEPTION 'Only % units available in batch %', v_batch.current_quantity, v_batch.batch_number;
    END IF;

    UPDATE public.medicine_batches SET current_quantity = current_quantity - v_qty WHERE id = v_batch.id;

    INSERT INTO public.dispensing_items (dispensing_id, medicine_id, batch_id, batch_number, quantity)
    VALUES (v_id, v_batch.medicine_id, v_batch.id, v_batch.batch_number, v_qty);

    INSERT INTO public.stock_transactions (medicine_id, batch_id, batch_number, txn_type, quantity_change,
      previous_quantity, new_quantity, reason, user_id, user_name)
    VALUES (v_batch.medicine_id, v_batch.id, v_batch.batch_number, 'dispensed', -v_qty,
      v_batch.current_quantity, v_batch.current_quantity - v_qty, 'Dispensed via ' || v_ref, auth.uid(), v_uname);

    SELECT name || COALESCE(' ' || strength, '') INTO v_med FROM public.medicines WHERE id = v_batch.medicine_id;
    INSERT INTO public.audit_logs (user_id, user_name, action, module, record_ref, description)
    VALUES (auth.uid(), v_uname, 'Dispensed medicine', 'Dispensing', v_ref,
      v_uname || ' dispensed ' || v_qty || ' units of ' || v_med || ' (batch ' || v_batch.batch_number || ')');
  END LOOP;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_dispensing(uuid, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_batch_id uuid, p_delta integer, p_reason text, p_notes text
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_batch public.medicine_batches; v_txn uuid; v_uname text := public.current_user_name();
  v_type public.stock_txn_type; v_med text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(p_reason,'') = '' THEN RAISE EXCEPTION 'A reason is required for stock adjustments'; END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RAISE EXCEPTION 'Adjustment quantity cannot be zero'; END IF;
  IF abs(p_delta) > 20 AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist')) THEN
    RAISE EXCEPTION 'Adjustments larger than 20 units require a pharmacist or admin';
  END IF;

  SELECT * INTO v_batch FROM public.medicine_batches WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF v_batch.current_quantity + p_delta < 0 THEN RAISE EXCEPTION 'Adjustment would make stock negative'; END IF;

  v_type := CASE lower(p_reason)
    WHEN 'damaged' THEN 'damaged'::public.stock_txn_type
    WHEN 'expired' THEN 'expired'::public.stock_txn_type
    WHEN 'returned' THEN 'returned'::public.stock_txn_type
    ELSE 'adjustment'::public.stock_txn_type END;

  UPDATE public.medicine_batches SET current_quantity = current_quantity + p_delta WHERE id = v_batch.id;

  INSERT INTO public.stock_transactions (medicine_id, batch_id, batch_number, txn_type, quantity_change,
    previous_quantity, new_quantity, reason, user_id, user_name)
  VALUES (v_batch.medicine_id, v_batch.id, v_batch.batch_number, v_type, p_delta,
    v_batch.current_quantity, v_batch.current_quantity + p_delta,
    p_reason || COALESCE(' - ' || NULLIF(p_notes,''), ''), auth.uid(), v_uname)
  RETURNING id INTO v_txn;

  SELECT name || COALESCE(' ' || strength, '') INTO v_med FROM public.medicines WHERE id = v_batch.medicine_id;
  INSERT INTO public.audit_logs (user_id, user_name, action, module, record_ref, description)
  VALUES (auth.uid(), v_uname, 'Adjusted stock', 'Inventory', v_batch.batch_number,
    v_uname || ' adjusted ' || v_med || ' batch ' || v_batch.batch_number || ' by ' || p_delta || ' (' || p_reason || ')');

  RETURN v_txn;
END;
$$;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer, text, text) TO authenticated;

CREATE VIEW public.medicine_stock_summary
WITH (security_invoker = true) AS
SELECT m.id AS medicine_id,
  COALESCE(SUM(b.current_quantity), 0)::int AS total_quantity,
  COALESCE(SUM(CASE WHEN b.expiry_date > current_date THEN b.current_quantity ELSE 0 END), 0)::int AS usable_quantity,
  COALESCE(SUM(CASE WHEN b.expiry_date <= current_date THEN b.current_quantity ELSE 0 END), 0)::int AS expired_quantity,
  MIN(CASE WHEN b.expiry_date > current_date AND b.current_quantity > 0 THEN b.expiry_date END) AS next_expiry,
  COUNT(b.id) FILTER (WHERE b.current_quantity > 0) AS active_batches
FROM public.medicines m
LEFT JOIN public.medicine_batches b ON b.medicine_id = m.id
GROUP BY m.id;
GRANT SELECT ON public.medicine_stock_summary TO authenticated;

CREATE INDEX idx_batches_medicine ON public.medicine_batches(medicine_id);
CREATE INDEX idx_batches_expiry ON public.medicine_batches(expiry_date);
CREATE INDEX idx_txn_medicine ON public.stock_transactions(medicine_id, created_at DESC);
CREATE INDEX idx_dspi_medicine ON public.dispensing_items(medicine_id);