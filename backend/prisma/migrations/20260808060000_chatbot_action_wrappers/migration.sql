-- Wrapper functions so the SNS executeQuery node runs a PURE SELECT
-- (SELECT fn(...) AS reply). The platform suppresses result rows when a
-- query contains a data-modifying statement (INSERT/DELETE), so the writes
-- live inside these functions and only a text reply is returned. sessionId
-- is coalesced so a missing caller id cannot violate the PK.

CREATE OR REPLACE FUNCTION sql_chat_preview_restock(p_session text, p_drug text, p_qty bigint)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE j jsonb; sid text := COALESCE(NULLIF(p_session, ''), 'anon');
BEGIN
  j := sql_restock(p_drug, p_qty, true);
  IF (j->>'ok') = 'true' THEN
    INSERT INTO "ChatbotPendingAction"("sessionId", action, params, summary, "createdAt")
    VALUES (sid, 'restock', jsonb_build_object('drug', p_drug, 'qty', p_qty), j->>'summary', now())
    ON CONFLICT ("sessionId") DO UPDATE
      SET action = EXCLUDED.action, params = EXCLUDED.params,
          summary = EXCLUDED.summary, "createdAt" = now();
    RETURN (j->>'summary') || '. Confirm? (yes/no)';
  END IF;
  RETURN j->>'error';
END;
$fn$;

CREATE OR REPLACE FUNCTION sql_chat_preview_create(
  p_session text, p_name text, p_dob text, p_gender text, p_phone text,
  p_ward text, p_bed text, p_adm text, p_diag text, p_all text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE j jsonb; sid text := COALESCE(NULLIF(p_session, ''), 'anon');
BEGIN
  j := sql_create_patient(p_name, p_dob, p_gender, p_phone, p_ward, p_bed, p_adm, p_diag, p_all, true);
  IF (j->>'ok') = 'true' THEN
    INSERT INTO "ChatbotPendingAction"("sessionId", action, params, summary, "createdAt")
    VALUES (sid, 'create_patient', jsonb_build_object(
      'name', p_name, 'dob', p_dob, 'gender', p_gender, 'phone', p_phone,
      'wardCode', p_ward, 'bed', p_bed, 'admissionDate', p_adm,
      'diagnosis', p_diag, 'allergies', p_all), j->>'summary', now())
    ON CONFLICT ("sessionId") DO UPDATE
      SET action = EXCLUDED.action, params = EXCLUDED.params,
          summary = EXCLUDED.summary, "createdAt" = now();
    RETURN (j->>'summary') || '. Confirm? (yes/no)';
  END IF;
  RETURN j->>'error';
END;
$fn$;

CREATE OR REPLACE FUNCTION sql_chat_commit(p_session text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE sid text := COALESCE(NULLIF(p_session, ''), 'anon'); r RECORD; j jsonb;
BEGIN
  SELECT action, params INTO r FROM "ChatbotPendingAction"
   WHERE "sessionId" = sid AND "createdAt" > now() - interval '5 minutes';
  IF NOT FOUND THEN
    RETURN 'Nothing to confirm — that request may have expired.';
  END IF;
  IF r.action = 'restock' THEN
    j := sql_restock(r.params->>'drug', (r.params->>'qty')::bigint, false);
  ELSIF r.action = 'create_patient' THEN
    j := sql_create_patient(r.params->>'name', r.params->>'dob', r.params->>'gender',
      r.params->>'phone', r.params->>'wardCode', r.params->>'bed',
      r.params->>'admissionDate', r.params->>'diagnosis', r.params->>'allergies', false);
  END IF;
  DELETE FROM "ChatbotPendingAction" WHERE "sessionId" = sid;
  RETURN COALESCE(j->>'summary', j->>'error', 'Done.');
END;
$fn$;

CREATE OR REPLACE FUNCTION sql_chat_cancel(p_session text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE sid text := COALESCE(NULLIF(p_session, ''), 'anon');
BEGIN
  DELETE FROM "ChatbotPendingAction" WHERE "sessionId" = sid;
  RETURN 'Cancelled.';
END;
$fn$;
