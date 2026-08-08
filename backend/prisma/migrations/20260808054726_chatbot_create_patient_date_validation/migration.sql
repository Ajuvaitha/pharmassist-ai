CREATE OR REPLACE FUNCTION sql_create_patient(
  p_name text, p_dob text, p_gender text, p_phone text,
  p_ward_code text, p_bed text, p_admission_date text,
  p_diagnosis text, p_allergies text, p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ward_id text;
  v_missing text[] := '{}';
  v_mrn     text;
  v_id      text;
  v_actor   text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN v_missing := array_append(v_missing, 'name'); END IF;
  IF p_dob IS NULL OR btrim(p_dob) = '' OR p_dob !~ '^\d{4}-\d{2}-\d{2}$' THEN v_missing := array_append(v_missing, 'dateOfBirth'); END IF;
  IF p_gender IS NULL OR p_gender NOT IN ('Male','Female','Other') THEN v_missing := array_append(v_missing, 'gender'); END IF;
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN v_missing := array_append(v_missing, 'phone'); END IF;
  IF p_bed IS NULL OR btrim(p_bed) = '' THEN v_missing := array_append(v_missing, 'bed'); END IF;
  IF p_admission_date IS NULL OR btrim(p_admission_date) = '' OR p_admission_date !~ '^\d{4}-\d{2}-\d{2}$' THEN v_missing := array_append(v_missing, 'admissionDate'); END IF;
  IF p_diagnosis IS NULL OR btrim(p_diagnosis) = '' THEN v_missing := array_append(v_missing, 'diagnosis'); END IF;
  IF p_allergies IS NULL THEN v_missing := array_append(v_missing, 'allergies'); END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing: ' || array_to_string(v_missing, ', '));
  END IF;

  SELECT id INTO v_ward_id FROM "Ward" WHERE code = p_ward_code;
  IF v_ward_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', format('No ward with code "%s"', p_ward_code));
  END IF;

  IF p_preview THEN
    RETURN jsonb_build_object('ok', true,
      'summary', format('Register %s in %s, bed %s', p_name, p_ward_code, p_bed),
      'params', jsonb_build_object(
        'name', p_name, 'dob', p_dob, 'gender', p_gender, 'phone', p_phone,
        'wardCode', p_ward_code, 'bed', p_bed, 'admissionDate', p_admission_date,
        'diagnosis', p_diagnosis, 'allergies', p_allergies));
  END IF;

  v_mrn   := 'MRN-' || lpad(((SELECT count(*) FROM "Patient") + 1)::text, 6, '0');
  v_id    := gen_random_uuid()::text;
  v_actor := (SELECT id FROM "User" WHERE username = 'chatbot');

  INSERT INTO "Patient"(id, mrn, name, "dateOfBirth", gender, phone, "wardId", bed,
                        "admissionDate", diagnosis, allergies, status)
  VALUES (v_id, v_mrn, p_name, p_dob::date, p_gender::"Gender", p_phone, v_ward_id, p_bed,
          p_admission_date::date, p_diagnosis, p_allergies, 'admitted');

  INSERT INTO "ActivityEvent"(id, type, "patientId", "wardId", "actorId", text)
  VALUES (gen_random_uuid()::text, 'register', v_id, v_ward_id, v_actor,
          format('Patient registered: %s — %s, %s (via assistant)', p_name, p_ward_code, p_bed));

  RETURN jsonb_build_object('ok', true, 'summary', format('Registered %s as %s', p_name, v_mrn));
END;
$fn$;
