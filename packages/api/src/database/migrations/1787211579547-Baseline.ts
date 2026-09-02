import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1787211579547 implements MigrationInterface {
  name = "Baseline1787211579547";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The baseline schema uses uuid_generate_v4() in its column defaults.
    // Make that dependency explicit for fresh databases.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_user_id" uuid, "name" character varying(255) NOT NULL, "category" character varying(50), "inventory_enabled" boolean NOT NULL DEFAULT true, "ai_chat_enabled" boolean NOT NULL DEFAULT true, "allow_orders_beyond_stock" boolean NOT NULL DEFAULT true, "gst_number" character varying(20), "drug_license_number_1" character varying(50), "drug_license_number_2" character varying(50), "invoice_sequence_fy" character varying(10), "invoice_sequence_value" integer NOT NULL DEFAULT '0', "credit_note_sequence_fy" character varying(10), "credit_note_sequence_value" integer NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'INR', "timezone" character varying NOT NULL DEFAULT 'Asia/Kolkata', "logo_url" text, "upi_qr_url" text, "address" text, "phone" character varying(20), "b2b_sync_enabled" boolean NOT NULL DEFAULT true, "custom_settings" jsonb, "notification_preferences" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "retailer_business_id" uuid NOT NULL, "wholesaler_business_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "initiated_by_business_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_df56bbbbf78fd6ee4966e194784" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ae26cd58b8b9fd00dcaf8d3995" ON "business_connections"  ("retailer_business_id", "wholesaler_business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "parent_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_108cff1cf3a679074531948ded" ON "categories"  ("business_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "phone" character varying(20), "linked_business_id" uuid, "email" character varying(255), "address" text, "gst_number" character varying(20), "credit_limit" numeric(15,2) NOT NULL DEFAULT '0', "outstanding_amount" numeric(15,2) NOT NULL DEFAULT '0', "advance_balance" numeric(15,2) NOT NULL DEFAULT '0', "notes" text, "custom_fields" jsonb, "payment_terms" character varying(50) DEFAULT 'due_on_receipt', "trade_discount_percentage" numeric(5,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid, "email" character varying(255) NOT NULL, "password_hash" character varying(255), "password_plain" text, "full_name" character varying(255), "role" character varying(50) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "last_active_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid, "token" text NOT NULL, "platform" character varying(20) NOT NULL DEFAULT 'android', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_977e24c520c49436d08e5eeea8a" UNIQUE ("token"), CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "category" character varying(100), "amount" numeric(15,2) NOT NULL, "description" text, "expense_date" date NOT NULL DEFAULT ('now'::text)::date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "name" character varying(50) NOT NULL, "capacity" integer NOT NULL DEFAULT '4', "status" character varying(50) NOT NULL DEFAULT 'available', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "linked_business_id" uuid, "name" character varying(255) NOT NULL, "contact_person" character varying(255), "phone" character varying(20), "alternate_phone" character varying(20), "email" character varying(255), "address" text, "city" character varying(100), "state" character varying(100), "pincode" character varying(10), "gst_number" character varying(20), "pan_number" character varying(10), "drug_license_number" character varying(50), "supplier_type" character varying(50), "payment_terms" character varying(50) DEFAULT 'due_on_receipt', "credit_limit" numeric(15,2) NOT NULL DEFAULT '0', "outstanding_amount" numeric(15,2) NOT NULL DEFAULT '0', "trade_discount_percentage" numeric(5,2) NOT NULL DEFAULT '0', "bank_details" jsonb, "is_active" boolean NOT NULL DEFAULT true, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "purchase_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchase_order_id" uuid NOT NULL, "product_id" uuid, "supplier_id" uuid, "quantity" numeric(15,2) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "batch_number" character varying(100), "expiry_date" date, "hsn_code" character varying(20), "scheme_quantity" numeric(15,2), "tax_percentage" numeric(5,2) NOT NULL DEFAULT '0', "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e3d9bea880baad86ff6de3290da" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "purchase_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "supplier_id" uuid, "order_number" character varying(50), "status" character varying(50) NOT NULL DEFAULT 'draft', "origin" character varying(20) NOT NULL DEFAULT 'manual', "mirrored_order_id" uuid, "total_amount" numeric(15,2) NOT NULL DEFAULT '0', "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_05148947415204a897e8beb2553" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "product_id" uuid NOT NULL, "batch_number" character varying(100), "expiry_date" date, "quantity" numeric(15,2) NOT NULL, "initial_quantity" numeric(15,2) NOT NULL, "purchase_price" numeric(15,2), "supplier_id" uuid, "purchase_order_id" uuid, "received_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_843fa9e28be96c903f8c71292fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48f05c0add93a7b2ae2759cbb6" ON "product_batches"  ("expiry_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82998c582d28f74cca4eff80a7" ON "product_batches"  ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ce1ca3414bd02ebe87f640d254" ON "product_batches"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "brand" character varying(100), "sku" character varying(100), "barcode" character varying(100), "category" character varying(100), "unit" character varying(50) NOT NULL DEFAULT 'piece', "purchase_price" numeric(15,2), "selling_price" numeric(15,2) NOT NULL, "mrp" numeric(15,2), "tax_percentage" numeric(5,2) NOT NULL DEFAULT '0', "hsn_code" character varying(20), "stock_quantity" integer NOT NULL DEFAULT '0', "batch_number" character varying(100), "expiry_date" date, "last_supplier_id" uuid, "generic_name" character varying(255), "prescription_required" boolean NOT NULL DEFAULT false, "is_schedule_h1" boolean NOT NULL DEFAULT false, "description" text, "image_url" character varying(500), "is_available" boolean NOT NULL DEFAULT true, "is_draft" boolean NOT NULL DEFAULT false, "is_archived" boolean NOT NULL DEFAULT false, "unit_prices" jsonb, "custom_fields" jsonb, "moq" integer NOT NULL DEFAULT '1', "reorder_point" integer, "volume_tiers" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "order_id" uuid NOT NULL, "table_id" uuid, "status" character varying(50) NOT NULL DEFAULT 'pending', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dcdcc44e68aba4472841f08355c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "product_id" uuid, "kot_id" uuid, "custom_product_name" character varying(255), "quantity" numeric(15,2) NOT NULL, "unit" character varying(50), "unit_price" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "tax_percentage" numeric(5,2) NOT NULL DEFAULT '0', "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "returned_quantity" numeric(15,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid, "customer_name" character varying(255) NOT NULL, "patient_name" character varying(255), "doctor_name" character varying(255), "doctor_registration_number" character varying(100), "prescription_image_key" character varying(500), "table_id" uuid, "guest_count" integer, "order_number" character varying(50), "client_request_id" character varying(255), "token_number" integer, "order_type" character varying(50) NOT NULL DEFAULT 'regular', "status" character varying(50) NOT NULL DEFAULT 'draft', "origin" character varying(20) NOT NULL DEFAULT 'manual', "mirrored_purchase_order_id" uuid, "total_amount" numeric(15,2) NOT NULL DEFAULT '0', "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "notes" text, "created_by_user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_db09632a24776c3c96fe93982f" ON "orders"  ("business_id", "client_request_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "order_id" uuid, "invoice_number" character varying(50) NOT NULL, "type" character varying(20) NOT NULL DEFAULT 'invoice', "reference_invoice_id" uuid, "total_amount" numeric(15,2) NOT NULL, "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "pdf_url" text, "share_token" character varying(64), "share_token_expires_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "product_id" uuid, "custom_product_name" character varying(255), "quantity" numeric(15,2) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "tax_percentage" numeric(5,2) NOT NULL DEFAULT '0', "tax_amount" numeric(15,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_scan_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scan_id" uuid NOT NULL, "file_url" text NOT NULL, "file_type" character varying(20) NOT NULL, "page_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e76e343b40f745ccf7ca582b717" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_scans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "supplier_id" uuid, "purchase_order_id" uuid, "file_url" text, "file_type" character varying(20), "status" character varying(20) NOT NULL DEFAULT 'processing', "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_97fa219f1732b956b67242cfbf2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_scan_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scan_id" uuid NOT NULL, "raw_product_name" character varying(255) NOT NULL, "matched_product_id" uuid, "is_duplicate" boolean NOT NULL DEFAULT false, "included" boolean NOT NULL DEFAULT true, "quantity" numeric(15,2) NOT NULL, "scheme_quantity" numeric(15,2), "unit_price" numeric(15,2), "mrp" numeric(15,2), "batch_number" character varying(100), "expiry_month_year" character varying(7), "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d2e8aadf20e042d9b7f8bca6872" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ledgers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid, "supplier_id" uuid, "type" character varying(20) NOT NULL, "amount" numeric(15,2) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e8af998892a129f7cf69285d601" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid, "type" character varying(50) NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "code" character varying(6) NOT NULL, "purpose" character varying(20) NOT NULL DEFAULT 'login', "expires_at" TIMESTAMP NOT NULL, "consumed" boolean NOT NULL DEFAULT false, "attempts" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_item_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_item_id" uuid NOT NULL, "batch_id" uuid NOT NULL, "quantity" numeric(15,2) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_55682b6df2214e4f1ea5a0a0e59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ffb4e6c980ef6dd1148c21427" ON "order_item_batches"  ("batch_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "order_id" uuid, "amount" numeric(15,2) NOT NULL, "payment_method" character varying(50), "status" character varying(50) NOT NULL DEFAULT 'completed', "transaction_id" character varying(100), "client_request_id" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_95fbc6cbb15cd2ced7cfb3d615" ON "payments"  ("business_id", "client_request_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "announcement_active" boolean NOT NULL DEFAULT false, "announcement_message" text, "announcement_type" character varying(20) NOT NULL DEFAULT 'info', "maintenance_mode" boolean NOT NULL DEFAULT false, "maintenance_message" text, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2934aeb70ec285196dcab4a2e96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "price_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "product_id" uuid, "custom_product_name" character varying(255), "price" numeric(15,2) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e41e25472373d4b574b153229e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "product_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "volume_value" numeric(10,3), "uom" character varying(20), "sku" character varying(100), "barcode" character varying(100), "cost_price" numeric(15,2), "mrp" numeric(15,2) NOT NULL, "selling_price" numeric(15,2) NOT NULL, "stock_quantity" integer NOT NULL DEFAULT '0', "is_available" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6343513e20e2deab45edfce131" ON "product_variants"  ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d8deb0e0812b6870852984c81" ON "product_variants"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "permissions" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "salesmen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid, "name" character varying(100) NOT NULL, "phone" character varying(20), "route" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bdf2846708fc9ad6c61f4173e63" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "stocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "product_id" uuid, "variant_id" uuid, "type" character varying(20) NOT NULL, "quantity" integer NOT NULL, "reference" character varying(100), "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b5b1ee4ac914767229337974575" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "supplier_returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "supplier_id" uuid NOT NULL, "product_id" uuid NOT NULL, "purchase_order_id" uuid, "batch_number" character varying(100), "quantity" numeric(15,2) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "amount" numeric(15,2) NOT NULL, "reason" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_700c8777a97d463d3ecc01aa189" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "visits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "salesman_id" uuid NOT NULL, "customer_id" uuid, "check_in_time" TIMESTAMP, "check_out_time" TIMESTAMP, "gps_location" character varying(100), "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0b0b322289a41015c6ea4e8bf30" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "waiters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid, "name" character varying(100) NOT NULL, "phone" character varying(20), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_df5994939f2fa56fc0e22c711ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "app_releases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platform" character varying(20) NOT NULL DEFAULT 'android', "version" character varying(50) NOT NULL, "bundle_url" text NOT NULL, "checksum" character varying(64) NOT NULL, "min_native_version" character varying(20), "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e5b28b6fe128172639b75251cd1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "app_apk_releases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platform" character varying(20) NOT NULL DEFAULT 'android', "version_name" character varying(20) NOT NULL, "apk_url" text NOT NULL, "checksum" character varying(64) NOT NULL, "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9ee494a176f506996ae9527122" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "shared_barcode_catalog" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "barcode" character varying(100) NOT NULL, "name" character varying(255) NOT NULL, "suggested_price" numeric(15,2), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cff2bc04dcfdb3051495c774d08" UNIQUE ("barcode"), CONSTRAINT "PK_b48ca6fb6160ffddf7276274001" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attendances_status_enum" AS ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attendances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid NOT NULL, "date" character varying(10) NOT NULL, "clock_in" TIMESTAMP, "clock_out" TIMESTAMP, "status" "public"."attendances_status_enum" NOT NULL DEFAULT 'PRESENT', "shift_hours" numeric(5,2) NOT NULL DEFAULT '0', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_483ed97cd4cd43ab4a117516b69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1746ab08e5f7c0b9944fb5f9c2" ON "attendances"  ("business_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_490a4834ce75b3812a00bcbb1a" ON "attendances"  ("business_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commissions_status_enum" AS ENUM('PENDING', 'APPROVED', 'PAID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "commissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid NOT NULL, "order_id" uuid, "sale_amount" numeric(12,2) NOT NULL DEFAULT '0', "commission_rate" numeric(5,2) NOT NULL DEFAULT '0', "commission_earned" numeric(12,2) NOT NULL DEFAULT '0', "status" "public"."commissions_status_enum" NOT NULL DEFAULT 'PENDING', "paid_at" TIMESTAMP, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2701379966e2e670bb5ff0ae78e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52a56e244d32416a0e541bfd71" ON "commissions"  ("business_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bebeb8e20fe8aa11862a69dbfa" ON "commissions"  ("business_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "business_id" uuid, "action" character varying(100) NOT NULL, "resource" character varying(100), "metadata" jsonb, "ip_address" character varying(45), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8cba6ba151a9dda40181f99386a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_connections" ADD CONSTRAINT "FK_edda2bd55b1c34b108865c7c4ab" FOREIGN KEY ("retailer_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_connections" ADD CONSTRAINT "FK_8dbb26793d4fe590f34d0b1af28" FOREIGN KEY ("wholesaler_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_91da72e2f6ec2a1c45a8f4aaf30" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_c04b1ab3076e753f96c64318286" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_864a3c8e0aedf9be231c4614ce4" FOREIGN KEY ("linked_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_cde4b2aabca86cfabdc78b537f0" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_641011a87c8bd01845887b19cf1" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_ef28e0814977f1c47575f0814c7" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" ADD CONSTRAINT "FK_a18c9ff572d96d1de4348797a2b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD CONSTRAINT "FK_b03cdb57ba2af2a4d185d8e81f5" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD CONSTRAINT "FK_9f1b1c0adcea3da1a9302034e36" FOREIGN KEY ("linked_business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" ADD CONSTRAINT "FK_121744c3063cfae889a37384fe4" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" ADD CONSTRAINT "FK_43694b2fa800ce38d2da9ce74d6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" ADD CONSTRAINT "FK_ecc3a17cde49baab907b7153a74" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_4ac1ec23b6b7dbbe09358732f61" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_d16a885aa88447ccfd010e739b0" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" ADD CONSTRAINT "FK_ce1ca3414bd02ebe87f640d2544" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" ADD CONSTRAINT "FK_82998c582d28f74cca4eff80a73" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" ADD CONSTRAINT "FK_c877a35c876b116df937f1754f1" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" ADD CONSTRAINT "FK_011591d355c11e2082dce47f11e" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_6706ea94d32be01f9272ccc3512" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_2e6a9a86c2584e025249f92a0fd" FOREIGN KEY ("last_supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" ADD CONSTRAINT "FK_f3009ab602503f36319583cee58" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" ADD CONSTRAINT "FK_c5f94e2b0e2544c85b942d70177" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" ADD CONSTRAINT "FK_1b3950413381fd1c1a1baa35222" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_9263386c35b6b242540f9493b00" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_50eea45069d59addc62f2414c76" FOREIGN KEY ("kot_id") REFERENCES "kot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_0e78f67403faf37092dce90d73a" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_3d36410e89a795172fa6e0dd968" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_a03a66fe7daff0497b2ef13760a" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_8f96c84343bd7d6cb4374e9788f" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_ea83c3b911906a3578de2340fdf" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_d831e2cc180e00f582b10bbae31" FOREIGN KEY ("reference_invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_5a76734b5eead0967cf6ee3abc0" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_files" ADD CONSTRAINT "FK_bb58480cd5cbe98bdc5f0ec9c22" FOREIGN KEY ("scan_id") REFERENCES "invoice_scans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" ADD CONSTRAINT "FK_8e19cc56d6331129162c2bf8fdc" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" ADD CONSTRAINT "FK_179f48aa139d494286b55e1f21d" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" ADD CONSTRAINT "FK_e7db54064c3b6d29816236641de" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_items" ADD CONSTRAINT "FK_874d23d83cba15bc5a921f987ca" FOREIGN KEY ("scan_id") REFERENCES "invoice_scans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_items" ADD CONSTRAINT "FK_a4f18856a67087d45876c065990" FOREIGN KEY ("matched_product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" ADD CONSTRAINT "FK_f35e4d3b924d83c49c61e606471" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" ADD CONSTRAINT "FK_f833e4a6d9e31768cdc56c63df8" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" ADD CONSTRAINT "FK_f5f5d70fc7dc2592ca5af38c1a1" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_b1b5043ada10de525123ccdd40e" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_batches" ADD CONSTRAINT "FK_103f6f90e64af3b8d6da5914b62" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_batches" ADD CONSTRAINT "FK_8ffb4e6c980ef6dd1148c214276" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_07889d42d0b29705cf4a649576b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" ADD CONSTRAINT "FK_c367035ebec7c0115762e71f92e" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" ADD CONSTRAINT "FK_ebd3304630b8f13aa9c3cc25510" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" ADD CONSTRAINT "FK_ebdb4d54c8de7847c0f7a9e4fbb" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_0d8deb0e0812b6870852984c814" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_6343513e20e2deab45edfce1316" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "salesmen" ADD CONSTRAINT "FK_a1e6ba44fd8d654044fd950167e" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "salesmen" ADD CONSTRAINT "FK_1ad5ff6a492223d5f68b8682963" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" ADD CONSTRAINT "FK_cb1e0f7f972ad427137f6bccebb" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" ADD CONSTRAINT "FK_cdcdc9a4b531cbd24c06bc4f9e7" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" ADD CONSTRAINT "FK_a9773f4dd739dc4fc7d4644f932" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" ADD CONSTRAINT "FK_8b047b1ad7450da53bd4be9322b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" ADD CONSTRAINT "FK_e259919f3bf18a5c54dcac65fd0" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" ADD CONSTRAINT "FK_bc5bd3e261a01539766d9f941b6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" ADD CONSTRAINT "FK_286897cf8399878c4cabecbbd34" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visits" ADD CONSTRAINT "FK_47d57b573e94471c611608cc90e" FOREIGN KEY ("salesman_id") REFERENCES "salesmen"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visits" ADD CONSTRAINT "FK_b88a2340a967b0c834f225609c0" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "waiters" ADD CONSTRAINT "FK_fcd64a1e48a48a41db40af9b087" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "waiters" ADD CONSTRAINT "FK_b33a609508349b636ef9a1dcc22" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_aa902e05aeb5fde7c1dd4ced2b7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" ADD CONSTRAINT "FK_b1472834a901392bf25e9e4f6a9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" ADD CONSTRAINT "FK_dacb8f7c50aca368cf461526d81" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_6bee9b70f24c404c7fafcedad72" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" ADD CONSTRAINT "FK_920697cc0fcd94331e3fa12164a" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_920697cc0fcd94331e3fa12164a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_activity_logs" DROP CONSTRAINT "FK_6bee9b70f24c404c7fafcedad72"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" DROP CONSTRAINT "FK_dacb8f7c50aca368cf461526d81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" DROP CONSTRAINT "FK_b1472834a901392bf25e9e4f6a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "FK_aa902e05aeb5fde7c1dd4ced2b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "waiters" DROP CONSTRAINT "FK_b33a609508349b636ef9a1dcc22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "waiters" DROP CONSTRAINT "FK_fcd64a1e48a48a41db40af9b087"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visits" DROP CONSTRAINT "FK_b88a2340a967b0c834f225609c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visits" DROP CONSTRAINT "FK_47d57b573e94471c611608cc90e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" DROP CONSTRAINT "FK_286897cf8399878c4cabecbbd34"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" DROP CONSTRAINT "FK_bc5bd3e261a01539766d9f941b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" DROP CONSTRAINT "FK_e259919f3bf18a5c54dcac65fd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_returns" DROP CONSTRAINT "FK_8b047b1ad7450da53bd4be9322b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" DROP CONSTRAINT "FK_a9773f4dd739dc4fc7d4644f932"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" DROP CONSTRAINT "FK_cdcdc9a4b531cbd24c06bc4f9e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stocks" DROP CONSTRAINT "FK_cb1e0f7f972ad427137f6bccebb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salesmen" DROP CONSTRAINT "FK_1ad5ff6a492223d5f68b8682963"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salesmen" DROP CONSTRAINT "FK_a1e6ba44fd8d654044fd950167e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "FK_6343513e20e2deab45edfce1316"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "FK_0d8deb0e0812b6870852984c814"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" DROP CONSTRAINT "FK_ebdb4d54c8de7847c0f7a9e4fbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" DROP CONSTRAINT "FK_ebd3304630b8f13aa9c3cc25510"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_history" DROP CONSTRAINT "FK_c367035ebec7c0115762e71f92e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_07889d42d0b29705cf4a649576b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_batches" DROP CONSTRAINT "FK_8ffb4e6c980ef6dd1148c214276"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_batches" DROP CONSTRAINT "FK_103f6f90e64af3b8d6da5914b62"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_b1b5043ada10de525123ccdd40e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" DROP CONSTRAINT "FK_f5f5d70fc7dc2592ca5af38c1a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" DROP CONSTRAINT "FK_f833e4a6d9e31768cdc56c63df8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledgers" DROP CONSTRAINT "FK_f35e4d3b924d83c49c61e606471"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_items" DROP CONSTRAINT "FK_a4f18856a67087d45876c065990"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_items" DROP CONSTRAINT "FK_874d23d83cba15bc5a921f987ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" DROP CONSTRAINT "FK_e7db54064c3b6d29816236641de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" DROP CONSTRAINT "FK_179f48aa139d494286b55e1f21d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scans" DROP CONSTRAINT "FK_8e19cc56d6331129162c2bf8fdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_scan_files" DROP CONSTRAINT "FK_bb58480cd5cbe98bdc5f0ec9c22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_5a76734b5eead0967cf6ee3abc0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_dc991d555664682cfe892eea2c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_d831e2cc180e00f582b10bbae31"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_ea83c3b911906a3578de2340fdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_8f96c84343bd7d6cb4374e9788f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_a03a66fe7daff0497b2ef13760a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_3d36410e89a795172fa6e0dd968"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_0e78f67403faf37092dce90d73a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_50eea45069d59addc62f2414c76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_9263386c35b6b242540f9493b00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" DROP CONSTRAINT "FK_1b3950413381fd1c1a1baa35222"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" DROP CONSTRAINT "FK_c5f94e2b0e2544c85b942d70177"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kot" DROP CONSTRAINT "FK_f3009ab602503f36319583cee58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_2e6a9a86c2584e025249f92a0fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_6706ea94d32be01f9272ccc3512"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" DROP CONSTRAINT "FK_011591d355c11e2082dce47f11e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" DROP CONSTRAINT "FK_c877a35c876b116df937f1754f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" DROP CONSTRAINT "FK_82998c582d28f74cca4eff80a73"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_batches" DROP CONSTRAINT "FK_ce1ca3414bd02ebe87f640d2544"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_d16a885aa88447ccfd010e739b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_4ac1ec23b6b7dbbe09358732f61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" DROP CONSTRAINT "FK_ecc3a17cde49baab907b7153a74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" DROP CONSTRAINT "FK_43694b2fa800ce38d2da9ce74d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_items" DROP CONSTRAINT "FK_121744c3063cfae889a37384fe4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" DROP CONSTRAINT "FK_9f1b1c0adcea3da1a9302034e36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" DROP CONSTRAINT "FK_b03cdb57ba2af2a4d185d8e81f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "FK_a18c9ff572d96d1de4348797a2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_ef28e0814977f1c47575f0814c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_641011a87c8bd01845887b19cf1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_cde4b2aabca86cfabdc78b537f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_864a3c8e0aedf9be231c4614ce4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_c04b1ab3076e753f96c64318286"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_91da72e2f6ec2a1c45a8f4aaf30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_connections" DROP CONSTRAINT "FK_8dbb26793d4fe590f34d0b1af28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_connections" DROP CONSTRAINT "FK_edda2bd55b1c34b108865c7c4ab"`,
    );
    await queryRunner.query(`DROP TABLE "user_activity_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bebeb8e20fe8aa11862a69dbfa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_52a56e244d32416a0e541bfd71"`,
    );
    await queryRunner.query(`DROP TABLE "commissions"`);
    await queryRunner.query(`DROP TYPE "public"."commissions_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_490a4834ce75b3812a00bcbb1a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1746ab08e5f7c0b9944fb5f9c2"`,
    );
    await queryRunner.query(`DROP TABLE "attendances"`);
    await queryRunner.query(`DROP TYPE "public"."attendances_status_enum"`);
    await queryRunner.query(`DROP TABLE "shared_barcode_catalog"`);
    await queryRunner.query(`DROP TABLE "app_apk_releases"`);
    await queryRunner.query(`DROP TABLE "app_releases"`);
    await queryRunner.query(`DROP TABLE "waiters"`);
    await queryRunner.query(`DROP TABLE "visits"`);
    await queryRunner.query(`DROP TABLE "supplier_returns"`);
    await queryRunner.query(`DROP TABLE "stocks"`);
    await queryRunner.query(`DROP TABLE "salesmen"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d8deb0e0812b6870852984c81"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6343513e20e2deab45edfce131"`,
    );
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(`DROP TABLE "price_history"`);
    await queryRunner.query(`DROP TABLE "platform_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95fbc6cbb15cd2ced7cfb3d615"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8ffb4e6c980ef6dd1148c21427"`,
    );
    await queryRunner.query(`DROP TABLE "order_item_batches"`);
    await queryRunner.query(`DROP TABLE "otp_codes"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "ledgers"`);
    await queryRunner.query(`DROP TABLE "invoice_scan_items"`);
    await queryRunner.query(`DROP TABLE "invoice_scans"`);
    await queryRunner.query(`DROP TABLE "invoice_scan_files"`);
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_db09632a24776c3c96fe93982f"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "kot"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ce1ca3414bd02ebe87f640d254"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_82998c582d28f74cca4eff80a7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48f05c0add93a7b2ae2759cbb6"`,
    );
    await queryRunner.query(`DROP TABLE "product_batches"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP TABLE "purchase_items"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(`DROP TABLE "tables"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_108cff1cf3a679074531948ded"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae26cd58b8b9fd00dcaf8d3995"`,
    );
    await queryRunner.query(`DROP TABLE "business_connections"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
  }
}
