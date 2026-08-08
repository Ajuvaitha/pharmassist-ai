CREATE OR REPLACE FUNCTION sql_restock(p_drug text, p_qty bigint, p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_drug_id text;
  v_label   text;
  v_stock   int;
  v_count   int;
  v_actor   text;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be a positive number');
  END IF;

  SELECT count(*) INTO v_count
  FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
  WHERE d.label ILIKE '%' || p_drug || '%';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', format('No drug matching "%s"', p_drug));
  ELSIF v_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Ambiguous drug — did you mean: ' || (
        SELECT string_agg(d.label, ', ' ORDER BY d.label)
        FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
        WHERE d.label ILIKE '%' || p_drug || '%'));
  END IF;

  SELECT d.id, d.label, i."currentStock"
    INTO v_drug_id, v_label, v_stock
  FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
  WHERE d.label ILIKE '%' || p_drug || '%';

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'summary', format('Add %s to %s (%s → %s)', p_qty, v_label, v_stock, v_stock + p_qty),
      'params', jsonb_build_object('drugId', v_drug_id, 'qty', p_qty));
  END IF;

  v_actor := (SELECT id FROM "User" WHERE username = 'chatbot');

  UPDATE "InventoryItem"
     SET "currentStock" = "currentStock" + p_qty, "updatedAt" = now()
   WHERE "drugId" = v_drug_id
   RETURNING "currentStock" INTO v_stock;

  INSERT INTO "StockMovement"(id, "drugId", delta, reason, ref, "actorId")
  VALUES (gen_random_uuid()::text, v_drug_id, p_qty, 'restock', NULL, v_actor);

  INSERT INTO "ActivityEvent"(id, type, "drugId", "actorId", text)
  VALUES (gen_random_uuid()::text, 'restock', v_drug_id, v_actor,
          format('Restocked %s — +%s (via assistant)', v_label, p_qty));

  RETURN jsonb_build_object('ok', true,
    'summary', format('Restocked %s: +%s, new stock %s', v_label, p_qty, v_stock));
END;
$fn$;
